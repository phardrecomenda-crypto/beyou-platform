import { z } from "zod";
import type { PaymentGateway, PaymentRepository } from "./payment-contracts";
import { PaymentError, type CardInput, type PaymentAttempt, type PaymentMethod, type PaymentStatus } from "../domain/payment";

const statusByProvider: Record<string, PaymentStatus> = {
  PENDING:"PENDING", AUTHORIZED:"AUTHORIZED", CONFIRMED:"CONFIRMED", RECEIVED:"RECEIVED",
  OVERDUE:"EXPIRED", REFUNDED:"REFUNDED", DELETED:"CANCELLED",
};

const cardSchema = z.object({
  holderName: z.string().trim().min(2).max(120),
  number: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().regex(/^\d{13,19}$/)),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/),
  expiryYear: z.string().regex(/^\d{4}$/),
  ccv: z.string().regex(/^\d{3,4}$/),
});

export class PaymentService {
  constructor(private readonly repository: PaymentRepository, private readonly gateway: PaymentGateway) {}

  private async customer(context: Awaited<ReturnType<PaymentRepository["loadReadyContext"]>> & {}) {
    const stored = await this.repository.findAsaasCustomer(context.userId);
    if (stored) return stored;
    const existing = await this.gateway.findCustomer(context.userId, context.cpf);
    const customerId = existing ?? await this.gateway.createCustomer(context);
    await this.repository.saveAsaasCustomer(context.userId, customerId);
    return customerId;
  }

  private async prepare(userId: string, method: PaymentMethod) {
    console.info("[payments] preparation started", { method });
    const context = await this.repository.loadReadyContext(userId, method);
    console.info("[payments] checkout context loaded", { method, ready: Boolean(context) });
    if (!context) throw new PaymentError("CHECKOUT_NOT_READY");
    if (method === "CREDIT_CARD" && !/^\d{10,11}$/.test(context.phone ?? "")) {
      throw new PaymentError("PHONE_REQUIRED");
    }
    const open = await this.repository.findOpenAttempt(context.checkoutDraftId, method);
    console.info("[payments] open attempt checked", { method, found: Boolean(open) });
    return { context, open };
  }

  private async reconcile(attempt: PaymentAttempt) {
    if (!attempt.providerPaymentId) return attempt;
    const payment = await this.gateway.getPayment(attempt.providerPaymentId);
    await this.repository.attachProvider(attempt.id, payment.id, payment.status);
    return { ...attempt, providerPaymentId:payment.id, status:statusByProvider[payment.status] ?? "PENDING" };
  }

  async createPix(userId: string): Promise<PaymentAttempt> {
    const { context, open } = await this.prepare(userId, "PIX");
    if (open?.pixCopyPaste) return this.reconcile(open);
    const attempt = open ?? await this.repository.createAttempt(context);
    console.info("[payments] payment attempt ready", { method: "PIX" });
    const customerId = await this.customer(context);
    const payment = await this.gateway.createPix(customerId, attempt.id, context.amountCents);
    await this.repository.attachProvider(attempt.id, payment.id, payment.status);
    const pix = await this.gateway.getPix(payment.id);
    return this.repository.attachPix(attempt.id, pix.payload, pix.encodedImage, pix.expirationDate);
  }

  async createCard(userId: string, input: CardInput, remoteIp: string): Promise<PaymentAttempt> {
    const parsed = cardSchema.safeParse(input);
    if (!parsed.success || !remoteIp) throw new PaymentError("CARD_INVALID");
    const { context, open } = await this.prepare(userId, "CREDIT_CARD");
    if (open?.providerPaymentId) return this.reconcile(open);
    const attempt = open ?? await this.repository.createAttempt(context);
    const customerId = await this.customer(context);
    const payment = await this.gateway.createCard(customerId, attempt.id, context, parsed.data, remoteIp);
    await this.repository.attachProvider(attempt.id, payment.id, payment.status);
    return { ...attempt, providerPaymentId: payment.id, status: payment.status === "CONFIRMED" ? "CONFIRMED" : "PENDING" };
  }
}
