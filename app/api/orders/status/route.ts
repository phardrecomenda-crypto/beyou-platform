import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const scoped = await createServerSupabaseClient();
  const { data, error } = await scoped.auth.getUser();
  if (error || !data.user) return NextResponse.json({ code:"AUTHENTICATION_REQUIRED" }, { status:401 });

  const paymentId = request.nextUrl.searchParams.get("paymentId")?.trim();
  if (!paymentId || paymentId.length > 120) return NextResponse.json({ code:"PAYMENT_ID_INVALID" }, { status:400 });

  const admin = createAdminSupabaseClient();
  const { data:attempt, error:attemptError } = await admin.from("payment_attempts")
    .select("id, status").eq("user_id", data.user.id).eq("provider_payment_id", paymentId).maybeSingle();
  if (attemptError) return NextResponse.json({ code:"ORDER_LOOKUP_FAILED" }, { status:500 });
  if (!attempt) return NextResponse.json({ order:null, paymentStatus:null });

  const { data:order, error:orderError } = await admin.from("orders")
    .select("id, order_number, status").eq("user_id", data.user.id).eq("payment_attempt_id", attempt.id).maybeSingle();
  if (orderError) return NextResponse.json({ code:"ORDER_LOOKUP_FAILED" }, { status:500 });
  return NextResponse.json({ order, paymentStatus:attempt.status }, { headers:{ "cache-control":"no-store" } });
}
