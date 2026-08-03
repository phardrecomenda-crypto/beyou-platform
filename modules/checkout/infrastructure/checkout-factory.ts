import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckoutService } from "../application/checkout-service";
import {
  SupabaseCheckoutRepository,
  SupabaseCheckoutSession,
} from "./supabase-checkout-repository";

export function createCheckoutService(client: SupabaseClient) {
  return new CheckoutService(
    new SupabaseCheckoutRepository(client),
    new SupabaseCheckoutSession(client),
  );
}
