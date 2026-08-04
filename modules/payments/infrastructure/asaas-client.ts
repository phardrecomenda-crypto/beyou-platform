import "server-only";
import type { AsaasCustomerInput, AsaasPayment, AsaasPix, PaymentGateway, PaymentContext } from "../application/payment-contracts";
import type { CardInput } from "../domain/payment";
import { PaymentError } from "../domain/payment";

type Json = Record<string, unknown>;

type AsaasError = {
  code?: unknown;
  description?: unknown;
};

function safeProviderErrors(data: Json) {
  if (!Array.isArray(data.errors)) return [];
  return data.errors.slice(0, 5).map((error: AsaasError) => ({
    code: typeof error?.code === "string" ? error.code.slice(0, 80) : "UNKNOWN",
    description: typeof error?.description === "string" ? error.description.slice(0, 240) : undefined,
  }));
}

export class AsaasClient implements PaymentGateway {
  private readonly baseUrl = process.env.ASAAS_API_URL ?? "https://api-sandbox.asaas.com/v3";
  private readonly apiKey = process.env.ASAAS_API_KEY;

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.apiKey) throw new PaymentError("PAYMENT_CONFIGURATION_MISSING");
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { accept: "application/json", access_token: this.apiKey, ...(init?.body ? { "content-type": "application/json" } : {}) },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({})) as Json;
    if (!response.ok) {
      console.error("[payments/asaas] provider request failed", {
        path,
        status: response.status,
        errors: safeProviderErrors(data),
      });
      throw new PaymentError("PAYMENT_PROVIDER_ERROR");
    }
    return data as T;
  }

  async findCustomer(externalReference: string, cpf: string) {
    const query = new URLSearchParams({ externalReference, cpfCnpj: cpf, limit: "1" });
    const result = await this.request<{ data?: Array<{ id?: string }> }>(`/customers?${query}`);
    return result.data?.[0]?.id ?? null;
  }

  async createCustomer(input: AsaasCustomerInput) {
    const result = await this.request<{ id: string }>("/customers", { method: "POST", body: JSON.stringify({
      name: input.name, cpfCnpj: input.cpf, email: input.email,
      mobilePhone: input.phone ?? undefined, postalCode: input.postalCode,
      address: input.address, addressNumber: input.addressNumber,
      province: input.province, externalReference: input.userId, notificationDisabled: true,
    }) });
    return result.id;
  }

  createPix(customerId: string, attemptId: string, amountCents: number) {
    return this.request<AsaasPayment>("/payments", { method: "POST", body: JSON.stringify({
      customer: customerId, billingType: "PIX", value: amountCents / 100,
      dueDate: new Date().toISOString().slice(0, 10), description: "Compra BEYOU",
      externalReference: attemptId,
    }) });
  }

  getPix(paymentId: string) {
    return this.request<AsaasPix>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
  }

  getPayment(paymentId: string) {
    return this.request<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`);
  }

  createCard(customerId: string, attemptId: string, context: PaymentContext, card: CardInput, remoteIp: string) {
    const installment = context.installments > 1
      ? { installmentCount: context.installments, totalValue: context.amountCents / 100 }
      : { value: context.amountCents / 100 };
    return this.request<AsaasPayment>("/payments", { method: "POST", body: JSON.stringify({
      customer: customerId, billingType: "CREDIT_CARD", ...installment,
      dueDate: new Date().toISOString().slice(0, 10), description: "Compra BEYOU",
      externalReference: attemptId, remoteIp,
      creditCard: card,
      creditCardHolderInfo: {
        name: context.name, email: context.email, cpfCnpj: context.cpf,
        postalCode: context.postalCode, addressNumber: context.addressNumber,
        phone: context.phone ?? undefined,
      },
    }) });
  }
}
