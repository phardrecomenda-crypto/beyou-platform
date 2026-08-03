"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createCheckoutService } from "../../modules/checkout/infrastructure/checkout-factory";
import {
  CheckoutAuthenticationError,
  CheckoutUnavailableError,
  CheckoutValidationError,
  type CheckoutDraft,
  type CreateAddressInput,
  type CustomerAddress,
  type StartCheckoutInput,
} from "../../modules/checkout/domain/checkout";

type CheckoutErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "ADDRESS_INVALID"
  | "PAYMENT_INVALID"
  | "INSTALLMENTS_INVALID"
  | "ACTIVE_CART_NOT_FOUND"
  | "EMPTY_CART"
  | "ADDRESS_NOT_FOUND"
  | "DRAFT_NOT_FOUND"
  | "CHECKOUT_ERROR";

export type AddressActionResult =
  | Readonly<{ ok: true; address: CustomerAddress }>
  | Readonly<{ ok: false; code: CheckoutErrorCode }>;

export type CheckoutActionResult =
  | Readonly<{ ok: true; checkout: CheckoutDraft }>
  | Readonly<{ ok: false; code: CheckoutErrorCode }>;

function failure(error: unknown): CheckoutErrorCode {
  if (error instanceof CheckoutAuthenticationError) return "AUTHENTICATION_REQUIRED";
  if (error instanceof CheckoutValidationError) return error.code;
  if (error instanceof CheckoutUnavailableError) return error.code;
  return "CHECKOUT_ERROR";
}

export async function createCustomerAddress(input: CreateAddressInput): Promise<AddressActionResult> {
  try {
    const service = createCheckoutService(await createServerSupabaseClient());
    const address = await service.createAddress(input);
    revalidatePath("/checkout");
    return { ok: true, address };
  } catch (error) {
    return { ok: false, code: failure(error) };
  }
}

export async function startCheckout(input: StartCheckoutInput): Promise<CheckoutActionResult> {
  try {
    const service = createCheckoutService(await createServerSupabaseClient());
    const checkout = await service.start(input);
    revalidatePath("/checkout");
    revalidatePath("/carrinho");
    return { ok: true, checkout };
  } catch (error) {
    return { ok: false, code: failure(error) };
  }
}
