"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";

export type ProfileState = { saved?: boolean; error?: "invalidPhone" };

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return {};
  const parsed = z
    .object({
      name: z.string().trim().max(120),
      phone: z.union([z.literal(""), z.string().trim().regex(/^\+?[0-9 ()\-/]{8,20}$/)]),
    })
    .safeParse({ name: form.get("name") ?? "", phone: String(form.get("phone") ?? "").trim() });
  if (!parsed.success) return { error: "invalidPhone" };
  await db
    .update(schema.users)
    .set({ name: parsed.data.name || null, phone: parsed.data.phone || null })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteAddress(id: number) {
  const user = await getCurrentUser();
  if (!user) return;
  await db.delete(schema.addresses).where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, user.id)));
  revalidatePath("/", "layout");
}

export async function makeDefaultAddress(id: number) {
  const user = await getCurrentUser();
  if (!user) return;
  await db.transaction(async (tx) => {
    await tx.update(schema.addresses).set({ isDefault: false }).where(eq(schema.addresses.userId, user.id));
    await tx
      .update(schema.addresses)
      .set({ isDefault: true })
      .where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, user.id)));
  });
  revalidatePath("/", "layout");
}
