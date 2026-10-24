"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import type { AddressFields } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { cartTotals, getCartLines } from "@/lib/cart";
import { isValidSlot } from "@/lib/delivery";
import { defaultLocale, isLocale } from "@/i18n/config";

export type CheckoutState = {
  error?: "minOrder" | "emptyCart" | "invalidPhone" | "required" | "invalidSlot";
  fields?: string[];
};

const optional = z.string().trim().max(100).optional().transform((v) => v || undefined);

const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()\-/]{8,20}$/),
  addressId: z.string().optional(),
  street: optional,
  house: optional,
  apartment: optional,
  floor: optional,
  entrance: optional,
  intercom: optional,
  municipality: optional,
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliverySlot: z.string().min(3).max(10),
  paymentMethod: z.enum(["cash", "card"]),
  comment: z.string().trim().max(1000).optional(),
  saveAddress: z.string().optional(),
});

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const rawLocale = String(form.get("locale"));
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/checkout`);

  const parsed = checkoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => String(i.path[0]));
    return { error: fields.includes("phone") ? "invalidPhone" : "required", fields };
  }
  const data = parsed.data;
  if (!isValidSlot(data.deliveryDate, data.deliverySlot)) return { error: "invalidSlot", fields: ["deliverySlot"] };

  let address: AddressFields | null = null;
  if (data.addressId && data.addressId !== "new") {
    const [saved] = await db
      .select({ fields: schema.addresses.fields })
      .from(schema.addresses)
      .where(and(eq(schema.addresses.id, Number(data.addressId)), eq(schema.addresses.userId, user.id)))
      .limit(1);
    address = saved?.fields ?? null;
  } else if (data.street && data.house) {
    address = {
      street: data.street,
      house: data.house,
      apartment: data.apartment,
      floor: data.floor,
      entrance: data.entrance,
      intercom: data.intercom,
      municipality: data.municipality,
    };
  }
  if (!address) return { error: "required", fields: ["street", "house"] };

  const lines = (await getCartLines()).filter((l) => l.available);
  if (lines.length === 0) return { error: "emptyCart" };
  const totals = cartTotals(lines);
  if (!totals.meetsMinimum) return { error: "minOrder" };

  const number = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(schema.orders)
      .values({
        userId: user.id,
        subtotalMinor: totals.subtotalMinor,
        deliveryFeeMinor: totals.deliveryFeeMinor,
        totalMinor: totals.totalMinor,
        customerName: data.name,
        phone: data.phone,
        email: user.email,
        address,
        deliveryDate: data.deliveryDate,
        deliverySlot: data.deliverySlot,
        paymentMethod: data.paymentMethod,
        comment: data.comment || null,
        locale,
      })
      .returning({ id: schema.orders.id });
    const orderNumber = `KS-${String(order.id).padStart(5, "0")}`;
    await tx.update(schema.orders).set({ number: orderNumber }).where(eq(schema.orders.id, order.id));
    await tx.insert(schema.orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        name: l.name,
        unit: l.unit,
        imageUrl: l.imageUrl,
        priceMinor: l.priceMinor,
        qty: l.qty,
        lineTotalMinor: l.lineTotalMinor,
      })),
    );

    const [cart] = await tx.select({ id: schema.carts.id }).from(schema.carts).where(eq(schema.carts.userId, user.id));
    if (cart) await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cart.id));

    if (!user.name || !user.phone) {
      await tx
        .update(schema.users)
        .set({ name: user.name ?? data.name, phone: user.phone ?? data.phone })
        .where(eq(schema.users.id, user.id));
    }
    if ((!data.addressId || data.addressId === "new") && data.saveAddress) {
      const existing = await tx
        .select({ id: schema.addresses.id })
        .from(schema.addresses)
        .where(eq(schema.addresses.userId, user.id));
      await tx.insert(schema.addresses).values({ userId: user.id, fields: address, isDefault: existing.length === 0 });
    }
    return orderNumber;
  });

  revalidatePath("/", "layout");
  redirect(`/${locale}/orders/${number}?placed=1`);
}
