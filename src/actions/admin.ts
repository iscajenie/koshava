"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") throw new Error("Forbidden");
}

const statusSchema = z.enum(schema.orderStatus.enumValues);
const idSchema = z.number().int().positive().max(2_147_483_647);

export async function setOrderStatus(orderId: number, status: string) {
  await requireAdmin();
  await db
    .update(schema.orders)
    .set({ status: statusSchema.parse(status), updatedAt: new Date() })
    .where(eq(schema.orders.id, idSchema.parse(orderId)));
  revalidatePath("/", "layout");
}

export async function saveAdminNote(form: FormData) {
  await requireAdmin();
  const orderId = idSchema.parse(Number(form.get("orderId")));
  const note = String(form.get("note") ?? "").slice(0, 2000);
  await db.update(schema.orders).set({ adminNote: note || null, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  revalidatePath("/", "layout");
}
