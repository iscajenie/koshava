"use server";

import { revalidatePath } from "next/cache";
import { clearCart, getCartQuantities, setCartQty } from "@/lib/cart";
import { setFavorite } from "@/lib/favorites";

export async function updateCartItem(productId: number, qty: number) {
  await setCartQty(productId, qty);
  revalidatePath("/", "layout");
  return getCartQuantities();
}

export async function emptyCart() {
  await clearCart();
  revalidatePath("/", "layout");
}

export async function toggleFavorite(productId: number, on: boolean) {
  await setFavorite(productId, on);
  revalidatePath("/", "layout");
}
