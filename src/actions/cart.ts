"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clearCart, getCartQuantities, setCartQty } from "@/lib/cart";
import { setFavorite } from "@/lib/favorites";

// Server actions are public endpoints: arguments arrive from the browser and are checked like any request.
const productIdSchema = z.number().int().positive().max(2_147_483_647);
const qtySchema = z.number().finite().min(0).max(1000);

export async function updateCartItem(productId: number, qty: number) {
  await setCartQty(productIdSchema.parse(productId), qtySchema.parse(qty));
  revalidatePath("/", "layout");
  return getCartQuantities();
}

export async function emptyCart() {
  await clearCart();
  revalidatePath("/", "layout");
}

export async function toggleFavorite(productId: number, on: boolean) {
  await setFavorite(productIdSchema.parse(productId), z.boolean().parse(on));
  revalidatePath("/", "layout");
}
