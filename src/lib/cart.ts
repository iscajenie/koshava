import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { deliveryFeeFor, shop } from "@/config/shop";
import { lineTotal } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureVisitorId, getVisitorId } from "@/lib/visitor";

type Owner = { userId: string } | { visitorId: string };

async function currentOwner(): Promise<Owner | null> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };
  const visitorId = await getVisitorId();
  return visitorId ? { visitorId } : null;
}

function ownerFilter(owner: Owner) {
  return "userId" in owner ? eq(schema.carts.userId, owner.userId) : eq(schema.carts.visitorId, owner.visitorId);
}

async function findCartId(owner: Owner) {
  const [cart] = await db.select({ id: schema.carts.id }).from(schema.carts).where(ownerFilter(owner)).limit(1);
  return cart?.id ?? null;
}

async function ensureCartId(): Promise<string> {
  const user = await getCurrentUser();
  const owner: Owner = user ? { userId: user.id } : { visitorId: await ensureVisitorId() };
  const existing = await findCartId(owner);
  if (existing) return existing;
  const [created] = await db
    .insert(schema.carts)
    .values("userId" in owner ? { userId: owner.userId } : { visitorId: owner.visitorId })
    .onConflictDoNothing()
    .returning({ id: schema.carts.id });
  return created?.id ?? (await findCartId(owner))!;
}

/** Rounds a requested quantity to what the product can be sold in. */
export function normalizeQty(qty: number, soldByWeight: boolean) {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const step = soldByWeight ? shop.weightStepKg : 1;
  const rounded = Math.round(qty / step) * step;
  return Math.min(Math.max(rounded, step), 99);
}

export async function setCartQty(productId: number, requestedQty: number) {
  const [product] = await db
    .select({ id: schema.products.id, soldByWeight: schema.products.soldByWeight })
    .from(schema.products)
    .where(and(eq(schema.products.id, productId), eq(schema.products.isPublished, true)))
    .limit(1);
  if (!product) return;
  const cartId = await ensureCartId();
  const qty = requestedQty <= 0 ? 0 : normalizeQty(requestedQty, product.soldByWeight);
  if (qty === 0) {
    await db
      .delete(schema.cartItems)
      .where(and(eq(schema.cartItems.cartId, cartId), eq(schema.cartItems.productId, productId)));
  } else {
    await db
      .insert(schema.cartItems)
      .values({ cartId, productId, qty })
      .onConflictDoUpdate({ target: [schema.cartItems.cartId, schema.cartItems.productId], set: { qty } });
  }
  await db.update(schema.carts).set({ updatedAt: new Date() }).where(eq(schema.carts.id, cartId));
}

export async function clearCart() {
  const owner = await currentOwner();
  if (!owner) return;
  const cartId = await findCartId(owner);
  if (cartId) await db.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cartId));
}

export type CartLine = {
  productId: number;
  qty: number;
  slug: string;
  name: string;
  brand: string | null;
  unit: string | null;
  soldByWeight: boolean;
  imageUrl: string | null;
  priceMinor: number;
  regularPriceMinor: number;
  available: boolean;
  lineTotalMinor: number;
};

export async function getCartLines(): Promise<CartLine[]> {
  const owner = await currentOwner();
  if (!owner) return [];
  const cartId = await findCartId(owner);
  if (!cartId) return [];
  const rows = await db
    .select({
      productId: schema.cartItems.productId,
      qty: schema.cartItems.qty,
      slug: schema.products.slug,
      name: schema.products.name,
      brand: schema.products.brand,
      unit: schema.products.unit,
      soldByWeight: schema.products.soldByWeight,
      imageUrl: schema.products.imageUrl,
      priceMinor: schema.products.priceMinor,
      regularPriceMinor: schema.products.regularPriceMinor,
      available: sql<boolean>`${schema.products.isPublished} and ${schema.products.isActive}`,
    })
    .from(schema.cartItems)
    .innerJoin(schema.products, eq(schema.products.id, schema.cartItems.productId))
    .where(eq(schema.cartItems.cartId, cartId))
    .orderBy(schema.cartItems.addedAt);
  return rows.map((r) => ({ ...r, lineTotalMinor: r.available ? lineTotal(r.priceMinor, r.qty) : 0 }));
}

export async function getCartQuantities(): Promise<Record<number, number>> {
  const owner = await currentOwner();
  if (!owner) return {};
  const cartId = await findCartId(owner);
  if (!cartId) return {};
  const rows = await db
    .select({ productId: schema.cartItems.productId, qty: schema.cartItems.qty })
    .from(schema.cartItems)
    .where(eq(schema.cartItems.cartId, cartId));
  return Object.fromEntries(rows.map((r) => [r.productId, r.qty]));
}

export function cartTotals(lines: CartLine[]) {
  const subtotalMinor = lines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  const deliveryFeeMinor = deliveryFeeFor(subtotalMinor);
  return {
    subtotalMinor,
    deliveryFeeMinor,
    totalMinor: subtotalMinor + deliveryFeeMinor,
    meetsMinimum: subtotalMinor >= shop.minOrderMinor,
    missingMinor: Math.max(0, shop.minOrderMinor - subtotalMinor),
    exceedsMaximum: subtotalMinor > shop.maxOrderMinor,
  };
}

/** Moves the guest cart and favorites into the user's account after sign-in. */
export async function adoptVisitorData(userId: string) {
  const visitorId = await getVisitorId();
  if (!visitorId) return;
  await db.transaction(async (tx) => {
    const [guestCart] = await tx
      .select({ id: schema.carts.id })
      .from(schema.carts)
      .where(eq(schema.carts.visitorId, visitorId))
      .limit(1);
    if (guestCart) {
      const items = await tx.select().from(schema.cartItems).where(eq(schema.cartItems.cartId, guestCart.id));
      if (items.length > 0) {
        await tx.insert(schema.carts).values({ userId }).onConflictDoNothing();
        const [userCart] = await tx
          .select({ id: schema.carts.id })
          .from(schema.carts)
          .where(eq(schema.carts.userId, userId))
          .limit(1);
        for (const item of items) {
          await tx
            .insert(schema.cartItems)
            .values({ cartId: userCart.id, productId: item.productId, qty: item.qty })
            .onConflictDoUpdate({
              target: [schema.cartItems.cartId, schema.cartItems.productId],
              set: { qty: sql`greatest(${schema.cartItems.qty}, excluded.qty)` },
            });
        }
      }
      await tx.delete(schema.carts).where(eq(schema.carts.id, guestCart.id));
    }
    const guestFavorites = await tx
      .select({ productId: schema.favorites.productId })
      .from(schema.favorites)
      .where(eq(schema.favorites.visitorId, visitorId));
    if (guestFavorites.length > 0) {
      await tx
        .insert(schema.favorites)
        .values(guestFavorites.map((f) => ({ userId, productId: f.productId })))
        .onConflictDoNothing();
      await tx.delete(schema.favorites).where(eq(schema.favorites.visitorId, visitorId));
    }
  });
}

export async function removeUnavailable(productIds: number[]) {
  const owner = await currentOwner();
  if (!owner || productIds.length === 0) return;
  const cartId = await findCartId(owner);
  if (!cartId) return;
  await db
    .delete(schema.cartItems)
    .where(and(eq(schema.cartItems.cartId, cartId), inArray(schema.cartItems.productId, productIds)));
}
