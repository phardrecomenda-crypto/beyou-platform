export type PaymentMethod = "PIX" | "CREDIT_CARD";
export type PaymentStatus = "CREATED" | "PENDING" | "AUTHORIZED" | "CONFIRMED" | "RECEIVED" | "FAILED" | "REFUNDED" | "CANCELLED" | "EXPIRED";

export type PaymentAttempt = Readonly<{
  id: string;
  userId: string;
  checkoutDraftId: string;
  providerPaymentId: string | null;
  status: PaymentStatus;
  method: PaymentMethod;
  amountCents: number;
  installments: number;
  pixCopyPaste: string | null;
  pixEncodedImage: string | null;
  pixExpiresAt: string | null;
}>;

export type CardInput = Readonly<{
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}>;

export class PaymentError extends Error {
  constructor(public readonly code: "AUTHENTICATION_REQUIRED" | "CHECKOUT_NOT_READY" | "BILLING_PROFILE_REQUIRED" | "PAYMENT_CONFIGURATION_MISSING" | "PAYMENT_PROVIDER_ERROR" | "CARD_INVALID") {
    super(code);
    this.name = "PaymentError";
  }
}
