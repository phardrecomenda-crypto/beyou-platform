import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin";
import { createPaymentService } from "../../../../modules/payments/infrastructure/payment-factory";
import { PaymentError, type CardInput } from "../../../../modules/payments/domain/payment";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const scoped = await createServerSupabaseClient();
    const { data, error } = await scoped.auth.getUser();
    if (error || !data.user) return NextResponse.json({ code:"AUTHENTICATION_REQUIRED" }, { status:401 });
    const input = await request.json() as CardInput;
    const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "";
    const payment = await createPaymentService(createAdminSupabaseClient()).createCard(data.user.id, input, remoteIp);
    return NextResponse.json({ payment });
  } catch (error) {
    const code = error instanceof PaymentError ? error.code : "PAYMENT_PROVIDER_ERROR";
    const status = code === "CARD_INVALID" ? 400 : code === "PAYMENT_CONFIGURATION_MISSING" ? 503 : code === "CHECKOUT_NOT_READY" ? 409 : 502;
    return NextResponse.json({ code }, { status });
  }
}
