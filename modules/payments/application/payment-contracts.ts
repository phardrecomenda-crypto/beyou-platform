import type { CardInput, PaymentAttempt, PaymentMethod, PaymentStatus } from "../domain/payment";

export type PaymentContext = Readonly<{
  userId: string;
  checkoutDraftId: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
  amountCents: number;
  installments: number;
  method: PaymentMethod;
}>;

export interface PaymentRepository {
  loadReadyContext(userId: string, method: PaymentMethod): Promise<PaymentContext | null>;
  findOpenAttempt(checkoutDraftId: string, method: PaymentMethod): Promise<PaymentAttempt | null>;
  createAttempt(context: PaymentContext): Promise<PaymentAttempt>;
  attachProvider(attemptId: string, providerPaymentId: string, providerStatus: string): Promise<void>;
  attachPix(attemptId: string, copyPaste: string, encodedImage: string, expiresAt: string): Promise<PaymentAttempt>;
  findAsaasCustomer(userId: string): Promise<string | null>;
  saveAsaasCustomer(userId: string, providerCustomerId: string): Promise<void>;
  recordWebhook(event: AsaasWebhook): Promise<boolean>;
  updateFromWebhook(providerPaymentId: string, status: PaymentStatus, providerStatus: string): Promise<void>;
}

export type AsaasCustomerInput = Omit<PaymentContext, "checkoutDraftId" | "amountCents" | "installments" | "method">;
export type AsaasPayment = Readonly<{ id: string; status: string }>;
export type AsaasPix = Readonly<{ payload: string; encodedImage: string; expirationDate: string }>;
export type AsaasWebhook = Readonly<{ id: string; event: string; payment?: Readonly<{ id?: string; status?: string }> }>;

export interface PaymentGateway {
  findCustomer(externalReference: string, cpf: string): Promise<string | null>;
  createCustomer(input: AsaasCustomerInput): Promise<string>;
  createPix(customerId: string, attemptId: string, amountCents: number): Promise<AsaasPayment>;
  getPix(paymentId: string): Promise<AsaasPix>;
  getPayment(paymentId: string): Promise<AsaasPayment>;
  createCard(customerId: string, attemptId: string, context: PaymentContext, card: CardInput, remoteIp: string): Promise<AsaasPayment>;
}
