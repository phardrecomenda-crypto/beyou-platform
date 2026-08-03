import "server-only";
import { createClient } from "@supabase/supabase-js";
import { PaymentError } from "../../modules/payments/domain/payment";

export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new PaymentError("PAYMENT_CONFIGURATION_MISSING");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
