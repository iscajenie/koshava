import "server-only";
import { count, desc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type OrderStatus = (typeof schema.orderStatus.enumValues)[number];
export const orderStatuses = schema.orderStatus.enumValues;

export async function getOrder(by: { number: string } | { id: number }) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where("number" in by ? eq(schema.orders.number, by.number) : eq(schema.orders.id, by.id))
    .limit(1);
  if (!order) return null;
  const items = await db
    .select({
      productId: schema.orderItems.productId,
      name: schema.orderItems.name,
      unit: schema.orderItems.unit,
      imageUrl: schema.orderItems.imageUrl,
      priceMinor: schema.orderItems.priceMinor,
      qty: schema.orderItems.qty,
      lineTotalMinor: schema.orderItems.lineTotalMinor,
      slug: schema.products.slug,
    })
    .from(schema.orderItems)
    .leftJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
    .where(eq(schema.orderItems.orderId, order.id));
  return { ...order, items };
}

export type OrderWithItems = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export function listUserOrders(userId: string) {
  return db
    .select({
      number: schema.orders.number,
      status: schema.orders.status,
      totalMinor: schema.orders.totalMinor,
      createdAt: schema.orders.createdAt,
      deliveryDate: schema.orders.deliveryDate,
      deliverySlot: schema.orders.deliverySlot,
    })
    .from(schema.orders)
    .where(eq(schema.orders.userId, userId))
    .orderBy(desc(schema.orders.createdAt));
}

export function listOrders(status?: OrderStatus) {
  return db
    .select({
      id: schema.orders.id,
      number: schema.orders.number,
      status: schema.orders.status,
      customerName: schema.orders.customerName,
      phone: schema.orders.phone,
      totalMinor: schema.orders.totalMinor,
      createdAt: schema.orders.createdAt,
      deliveryDate: schema.orders.deliveryDate,
      deliverySlot: schema.orders.deliverySlot,
      items: sql<number>`(select count(*)::int from ${schema.orderItems} where ${schema.orderItems.orderId} = ${schema.orders.id})`,
    })
    .from(schema.orders)
    .where(status ? eq(schema.orders.status, status) : undefined)
    .orderBy(desc(schema.orders.createdAt))
    .limit(200);
}

export async function adminStats() {
  const [orders] = await db
    .select({
      count: count(),
      revenue: sql<number>`coalesce(sum(${schema.orders.subtotalMinor}), 0)::int`,
    })
    .from(schema.orders)
    .where(ne(schema.orders.status, "cancelled"));
  const [users] = await db.select({ count: count() }).from(schema.users);
  const [carts] = await db
    .select({ count: sql<number>`count(distinct ${schema.cartItems.cartId})::int` })
    .from(schema.cartItems);
  const byStatus = await db
    .select({ status: schema.orders.status, count: count() })
    .from(schema.orders)
    .groupBy(schema.orders.status);
  return {
    orders: orders.count,
    revenueMinor: orders.revenue,
    avgMinor: orders.count ? Math.round(orders.revenue / orders.count) : 0,
    users: users.count,
    carts: carts.count,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.count])) as Partial<Record<OrderStatus, number>>,
  };
}

export async function catalogStats() {
  const p = schema.products;
  const [row] = await db
    .select({
      active: sql<number>`count(*) filter (where ${p.isActive})::int`,
      published: sql<number>`count(*) filter (where ${p.isPublished})::int`,
      hidden: sql<number>`count(*) filter (where ${p.isActive} and not ${p.isPublished})::int`,
      onSale: sql<number>`count(*) filter (where ${p.isPublished} and ${p.priceMinor} < ${p.regularPriceMinor})::int`,
    })
    .from(p);
  const runs = await db.select().from(schema.importRuns).orderBy(desc(schema.importRuns.startedAt)).limit(10);
  return { ...row, runs };
}
