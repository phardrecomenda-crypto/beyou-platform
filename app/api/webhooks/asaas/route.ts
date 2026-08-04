import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin";
import { SupabasePaymentRepository } from "../../../../modules/payments/infrastructure/supabase-payment-repository";
import type { PaymentStatus } from "../../../../modules/payments/domain/payment";

export const runtime = "nodejs";
const eventSchema = z.object({ id:z.string().min(1), event:z.string().min(1), payment:z.object({ id:z.string().optional(), status:z.string().optional() }).optional() }).passthrough();
const statusByEvent: Record<string, PaymentStatus> = {
  PAYMENT_CREATED:"PENDING", PAYMENT_PENDING:"PENDING", PAYMENT_AUTHORIZED:"AUTHORIZED",
  PAYMENT_CONFIRMED:"CONFIRMED", PAYMENT_RECEIVED:"RECEIVED", PAYMENT_OVERDUE:"EXPIRED",
  PAYMENT_REFUNDED:"REFUNDED", PAYMENT_DELETED:"CANCELLED", PAYMENT_REPROVED_BY_RISK_ANALYSIS:"FAILED",
};
const statusByProvider: Record<string, PaymentStatus> = {
  PENDING:"PENDING", AUTHORIZED:"AUTHORIZED", CONFIRMED:"CONFIRMED", RECEIVED:"RECEIVED",
  OVERDUE:"EXPIRED", REFUNDED:"REFUNDED", DELETED:"CANCELLED",
};
const digest = (value:string) => createHash("sha256").update(value).digest();

export async function POST(request: NextRequest) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  const received = request.headers.get("asaas-access-token") ?? "";
  if (!expected || !timingSafeEqual(digest(received), digest(expected))) return NextResponse.json({ code:"UNAUTHORIZED" }, { status:401 });
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code:"INVALID_EVENT" }, { status:400 });
  const repository = new SupabasePaymentRepository(createAdminSupabaseClient());
  const inserted = await repository.recordWebhook(parsed.data);
  if (!inserted) return NextResponse.json({ received:true, duplicate:true });
  const paymentId = parsed.data.payment?.id;
  const providerStatus = parsed.data.payment?.status;
  const status = statusByEvent[parsed.data.event] ?? (providerStatus ? statusByProvider[providerStatus] : undefined);
  if (paymentId && status) {
    await repository.updateFromWebhook(paymentId, status, providerStatus ?? parsed.data.event);
    if (status === "CONFIRMED" || status === "RECEIVED") {
      await repository.createOrderFromConfirmedPayment(paymentId, parsed.data.id);
    }
  }
  return NextResponse.json({ received:true });
}
