import type { SupabaseClient } from "@supabase/supabase-js";
import { OrderService } from "../application/order-service";
import { SupabaseOrderRepository, SupabaseOrderSession } from "./supabase-order-repository";

export function createOrderService(client: SupabaseClient) {
  return new OrderService(new SupabaseOrderSession(client), new SupabaseOrderRepository(client));
}
