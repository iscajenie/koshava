import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { nameKey } from "./price-list";

const sourceRank: Record<string, number> = { lidl: 3, maxi: 2, off: 1 };

/**
 * One-off migration from barcode keys to name keys. Rows of the same name (the same product under
 * different barcodes) are merged into the one with orders or the best photo; carts, favorites,
 * order lines and price history move to it, and every barcode seen is kept for photo lookups.
 */
export async function rekeyLegacyProducts() {
  const p = schema.products;
  const rows = await db
    .select({ id: p.id, sourceKey: p.sourceKey, sourceName: p.sourceName, barcode: p.barcode, altBarcodes: p.altBarcodes, contentSource: p.contentSource })
    .from(p);
  if (!rows.some((r) => !r.sourceKey.startsWith("n-"))) return 0;

  const ordered = new Set(
    (await db.selectDistinct({ id: schema.orderItems.productId }).from(schema.orderItems)).map((r) => r.id),
  );
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = nameKey(r.sourceName);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  let merged = 0;
  for (const [key, group] of groups) {
    if (group.every((r) => r.sourceKey === key)) continue;
    group.sort(
      (a, b) =>
        Number(ordered.has(b.id)) - Number(ordered.has(a.id)) ||
        (sourceRank[b.contentSource ?? ""] ?? 0) - (sourceRank[a.contentSource ?? ""] ?? 0) ||
        a.id - b.id,
    );
    const [keeper, ...others] = group;
    const barcodes = new Set(group.flatMap((r) => [r.barcode, ...r.altBarcodes]).filter((c): c is string => !!c));
    if (keeper.barcode) barcodes.delete(keeper.barcode);
    const otherIds = others.map((o) => o.id);

    await db.transaction(async (tx) => {
      if (otherIds.length > 0) {
        await tx.execute(sql`
          insert into cart_items (cart_id, product_id, qty, added_at)
          select cart_id, ${keeper.id}, qty, added_at from cart_items where product_id in ${otherIds}
          on conflict (cart_id, product_id) do update set qty = greatest(cart_items.qty, excluded.qty)`);
        await tx.execute(sql`
          insert into favorites (user_id, visitor_id, product_id, created_at)
          select user_id, visitor_id, ${keeper.id}, created_at from favorites where product_id in ${otherIds}
          on conflict do nothing`);
        await tx.execute(sql`
          update order_items set product_id = ${keeper.id}
          where product_id in ${otherIds}
            and not exists (select 1 from order_items o where o.order_id = order_items.order_id and o.product_id = ${keeper.id})`);
        await tx.execute(sql`
          insert into price_history (product_id, day, price_minor, regular_price_minor)
          select ${keeper.id}, day, price_minor, regular_price_minor from price_history where product_id in ${otherIds}
          on conflict do nothing`);
        await tx.delete(schema.cartItems).where(inArray(schema.cartItems.productId, otherIds));
        await tx.delete(schema.favorites).where(inArray(schema.favorites.productId, otherIds));
        await tx.delete(p).where(inArray(p.id, otherIds));
      }
      await tx.update(p).set({ sourceKey: key, altBarcodes: [...barcodes] }).where(eq(p.id, keeper.id));
    });
    merged += others.length;
  }
  return merged;
}
