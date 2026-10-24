import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureVisitorId, getVisitorId } from "@/lib/visitor";

async function ownerCondition(create: boolean) {
  const user = await getCurrentUser();
  if (user) return { userId: user.id, where: eq(schema.favorites.userId, user.id) };
  const visitorId = create ? await ensureVisitorId() : await getVisitorId();
  return visitorId ? { visitorId, where: eq(schema.favorites.visitorId, visitorId) } : null;
}

export async function getFavoriteIds(): Promise<number[]> {
  const owner = await ownerCondition(false);
  if (!owner) return [];
  const rows = await db
    .select({ productId: schema.favorites.productId })
    .from(schema.favorites)
    .where(owner.where)
    .orderBy(schema.favorites.createdAt);
  return rows.map((r) => r.productId);
}

export async function setFavorite(productId: number, on: boolean) {
  const owner = await ownerCondition(true);
  if (!owner) return;
  if (on) {
    await db
      .insert(schema.favorites)
      .values({ productId, userId: owner.userId ?? null, visitorId: owner.visitorId ?? null })
      .onConflictDoNothing();
  } else {
    await db.delete(schema.favorites).where(and(owner.where, eq(schema.favorites.productId, productId)));
  }
}
