import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AsaasWebhook, PaymentContext, PaymentRepository } from "../application/payment-contracts";
import type { PaymentAttempt, PaymentMethod, PaymentStatus } from "../domain/payment";

const attemptFields = "id, user_id, checkout_draft_id, provider_payment_id, status, payment_method, amount_cents, installments, pix_copy_paste, pix_encoded_image, pix_expires_at";
type AttemptRow = { id:string; user_id:string; checkout_draft_id:string; provider_payment_id:string|null; status:PaymentStatus; payment_method:PaymentMethod; amount_cents:number; installments:number; pix_copy_paste:string|null; pix_encoded_image:string|null; pix_expires_at:string|null };
type DraftRow = { id:string; user_id:string; address_id:string; total_cents:number|null; installments:number; payment_method:PaymentMethod };
type ProfileRow = { name:string; email:string; phone:string|null };
type BillingRow = { cpf:string };
type AddressRow = { phone:string; postal_code:string; street:string; number:string; neighborhood:string };
const mapAttempt = (row: AttemptRow): PaymentAttempt => ({ id:row.id, userId:row.user_id, checkoutDraftId:row.checkout_draft_id, providerPaymentId:row.provider_payment_id, status:row.status, method:row.payment_method, amountCents:row.amount_cents, installments:row.installments, pixCopyPaste:row.pix_copy_paste, pixEncodedImage:row.pix_encoded_image, pixExpiresAt:row.pix_expires_at });
const normalizePhone = (value: string | null | undefined) => value?.replace(/\D/g, "") ?? "";
const statusByProvider: Record<string, PaymentStatus> = {
  PENDING:"PENDING", AUTHORIZED:"AUTHORIZED", CONFIRMED:"CONFIRMED", RECEIVED:"RECEIVED",
  OVERDUE:"EXPIRED", REFUNDED:"REFUNDED", DELETED:"CANCELLED",
};

export class SupabasePaymentRepository implements PaymentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async loadReadyContext(userId: string, method: PaymentMethod): Promise<PaymentContext | null> {
    const draftResult = await this.client.from("checkout_drafts").select("id, user_id, address_id, total_cents, installments, payment_method")
      .eq("user_id", userId).eq("status", "READY").eq("payment_method", method)
      .gt("expires_at", new Date().toISOString()).order("updated_at", { ascending:false }).limit(1).maybeSingle();
    if (draftResult.error) throw draftResult.error;
    const draft = draftResult.data as DraftRow | null;
    if (!draft?.total_cents) return null;
    const [profileResult, billingResult, addressResult] = await Promise.all([
      this.client.from("profiles").select("name, email, phone").eq("user_id", userId).single(),
      this.client.from("billing_profiles").select("cpf").eq("user_id", userId).single(),
      this.client.from("customer_addresses").select("phone, postal_code, street, number, neighborhood").eq("id", draft.address_id).eq("user_id", userId).single(),
    ]);
    if (billingResult.error?.code === "PGRST116") return null;
    if (profileResult.error) throw profileResult.error;
    if (billingResult.error) throw billingResult.error;
    if (addressResult.error) throw addressResult.error;
    const profile=profileResult.data as ProfileRow, billing=billingResult.data as BillingRow, address=addressResult.data as AddressRow;
    const profilePhone = normalizePhone(profile.phone);
    const addressPhone = normalizePhone(address.phone);
    return { userId, checkoutDraftId:draft.id, name:profile.name, email:profile.email, phone:profilePhone || addressPhone || null, cpf:billing.cpf, postalCode:address.postal_code, address:address.street, addressNumber:address.number, province:address.neighborhood, amountCents:draft.total_cents, installments:draft.installments, method:draft.payment_method };
  }

  async findOpenAttempt(checkoutDraftId: string, method: PaymentMethod) {
    const { data, error } = await this.client.from("payment_attempts").select(attemptFields).eq("checkout_draft_id", checkoutDraftId).eq("payment_method", method).in("status", ["CREATED","PENDING","AUTHORIZED","CONFIRMED"]).order("created_at", { ascending:false }).limit(1).maybeSingle();
    if (error) throw error;
    return data ? mapAttempt(data as AttemptRow) : null;
  }
  async createAttempt(context: PaymentContext) {
    const { data, error } = await this.client.from("payment_attempts").insert({ user_id:context.userId, checkout_draft_id:context.checkoutDraftId, idempotency_key:crypto.randomUUID(), payment_method:context.method, amount_cents:context.amountCents, installments:context.installments }).select(attemptFields).single();
    if (error) throw error; return mapAttempt(data as AttemptRow);
  }
  async attachProvider(attemptId:string, providerPaymentId:string, providerStatus:string) {
    const status = statusByProvider[providerStatus] ?? "PENDING";
    const confirmedAt = ["CONFIRMED","RECEIVED"].includes(status) ? new Date().toISOString() : null;
    const { error } = await this.client.from("payment_attempts").update({ provider_payment_id:providerPaymentId, provider_status:providerStatus, status, confirmed_at:confirmedAt, updated_at:new Date().toISOString() }).eq("id", attemptId);
    if (error) throw error;
  }
  async attachPix(attemptId:string, copyPaste:string, encodedImage:string, expiresAt:string) {
    const { data, error } = await this.client.from("payment_attempts").update({ pix_copy_paste:copyPaste, pix_encoded_image:encodedImage, pix_expires_at:expiresAt, updated_at:new Date().toISOString() }).eq("id", attemptId).select(attemptFields).single();
    if (error) throw error; return mapAttempt(data as AttemptRow);
  }
  async findAsaasCustomer(userId:string) {
    const { data, error } = await this.client.from("asaas_customers").select("provider_customer_id").eq("user_id", userId).maybeSingle();
    if (error) throw error; return (data as {provider_customer_id:string}|null)?.provider_customer_id ?? null;
  }
  async saveAsaasCustomer(userId:string, providerCustomerId:string) {
    const { error } = await this.client.from("asaas_customers").upsert({ user_id:userId, provider_customer_id:providerCustomerId }, { onConflict:"user_id" });
    if (error) throw error;
  }
  async recordWebhook(event:AsaasWebhook) {
    const { error } = await this.client.from("asaas_webhook_events").insert({ provider_event_id:event.id, event_type:event.event, provider_payment_id:event.payment?.id ?? null, payload:event, attempts:1 });
    if (error?.code === "23505") return false;
    if (error) throw error; return true;
  }
  async updateFromWebhook(providerPaymentId:string, status:PaymentStatus, providerStatus:string) {
    const confirmedAt = ["CONFIRMED","RECEIVED"].includes(status) ? new Date().toISOString() : null;
    const { error } = await this.client.from("payment_attempts").update({ status, provider_status:providerStatus, confirmed_at:confirmedAt, updated_at:new Date().toISOString() }).eq("provider_payment_id", providerPaymentId);
    if (error) throw error;
    await this.client.from("asaas_webhook_events").update({ processed_at:new Date().toISOString() }).eq("provider_payment_id", providerPaymentId).is("processed_at", null);
  }
}
