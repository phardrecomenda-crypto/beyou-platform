import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { createCartService } from "../../../../modules/checkout/infrastructure/cart-factory";
import { CartAuthenticationError, CartUnavailableError } from "../../../../modules/checkout/domain/cart";

const inputSchema = z.object({ productId: z.string().uuid() });

function failure(error: unknown) {
  if (error instanceof CartAuthenticationError) return NextResponse.json({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (error instanceof CartUnavailableError && error.code === "PRODUCT_UNAVAILABLE") {
    return NextResponse.json({ code: "PRODUCT_UNAVAILABLE" }, { status: 409 });
  }
  console.error("[cart/items] operation failed", {
    code: typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code.slice(0, 80)
      : "UNKNOWN",
  });
  return NextResponse.json({ code: "CART_ERROR" }, { status: 500 });
}

async function input(request: Request) {
  return inputSchema.safeParse(await request.json().catch(() => null));
}

export async function POST(request: Request) {
  const parsed = await input(request);
  if (!parsed.success) return NextResponse.json({ code: "PRODUCT_UNAVAILABLE" }, { status: 400 });
  try {
    const cart = await createCartService(await createServerSupabaseClient()).addProduct(parsed.data.productId);
    return NextResponse.json({ cart });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  const parsed = await input(request);
  if (!parsed.success) return NextResponse.json({ code: "PRODUCT_UNAVAILABLE" }, { status: 400 });
  try {
    const cart = await createCartService(await createServerSupabaseClient()).removeProduct(parsed.data.productId);
    return NextResponse.json({ cart });
  } catch (error) {
    return failure(error);
  }
}
