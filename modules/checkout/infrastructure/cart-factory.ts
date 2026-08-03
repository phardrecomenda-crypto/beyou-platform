import type { SupabaseClient } from "@supabase/supabase-js";
import { CartService } from "../application/cart-service";
import { SupabaseCartRepository, SupabaseCartSession } from "./supabase-cart-repository";

export function createCartService(client: SupabaseClient) {
  return new CartService(
    new SupabaseCartRepository(client),
    new SupabaseCartSession(client),
  );
}
