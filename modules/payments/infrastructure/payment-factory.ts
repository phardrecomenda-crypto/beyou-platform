import type { SupabaseClient } from "@supabase/supabase-js";
import { PaymentService } from "../application/payment-service";
import { AsaasClient } from "./asaas-client";
import { SupabasePaymentRepository } from "./supabase-payment-repository";

export function createPaymentService(adminClient: SupabaseClient) {
  return new PaymentService(new SupabasePaymentRepository(adminClient), new AsaasClient());
}
