"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createCartService } from "../../modules/checkout/infrastructure/cart-factory";
import {
  CartAuthenticationError,
  CartConflictError,
  CartUnavailableError,
  type Cart,
} from "../../modules/checkout/domain/cart";

export type CartActionResult =
  | Readonly<{ ok: true; cart: Cart }>
  | Readonly<{ ok: false; code: "AUTHENTICATION_REQUIRED" | "PRODUCT_ALREADY_IN_CART" | "PRODUCT_UNAVAILABLE" | "CART_ERROR" }>;

function failure(error: unknown): CartActionResult {
  if (error instanceof CartAuthenticationError) return { ok: false, code: "AUTHENTICATION_REQUIRED" };
  if (error instanceof CartConflictError) return { ok: false, code: error.code === "PRODUCT_ALREADY_IN_CART" ? error.code : "CART_ERROR" };
  if (error instanceof CartUnavailableError) return { ok: false, code: error.code === "PRODUCT_UNAVAILABLE" ? error.code : "CART_ERROR" };
  return { ok: false, code: "CART_ERROR" };
}

export async function addProductToCart(productId: string): Promise<CartActionResult> {
  try {
    const cart = await createCartService(await createServerSupabaseClient()).addProduct(productId);
    revalidatePath("/loja", "layout");
    return { ok: true, cart };
  } catch (error) {
    return failure(error);
  }
}

export async function removeProductFromCart(productId: string): Promise<CartActionResult> {
  try {
    const cart = await createCartService(await createServerSupabaseClient()).removeProduct(productId);
    revalidatePath("/loja", "layout");
    return { ok: true, cart };
  } catch (error) {
    return failure(error);
  }
}
