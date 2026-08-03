import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin";
import { createPaymentService } from "../../../../modules/payments/infrastructure/payment-factory";
import { PaymentError } from "../../../../modules/payments/domain/payment";

export const runtime = "nodejs";

export async function POST() {
  try {
    const scoped = await createServerSupabaseClient();
    const { data, error } = await scoped.auth.getUser();
    if (error || !data.user) return NextResponse.json({ code:"AUTHENTICATION_REQUIRED" }, { status:401 });
    const payment = await createPaymentService(createAdminSupabaseClient()).createPix(data.user.id);
    return NextResponse.json({ payment });
  } catch (error) {
    const code = error instanceof PaymentError ? error.code : "PAYMENT_PROVIDER_ERROR";
    const status = code === "PAYMENT_CONFIGURATION_MISSING" ? 503 : code === "CHECKOUT_NOT_READY" ? 409 : 502;
    return NextResponse.json({ code }, { status });
  }
}
