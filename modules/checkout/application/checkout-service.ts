import { z } from "zod";
import type { CheckoutRepository, CheckoutSession } from "./checkout-repository";
import {
  CheckoutAuthenticationError,
  CheckoutUnavailableError,
  CheckoutValidationError,
  type CheckoutDraft,
  type CreateAddressInput,
  type CustomerAddress,
  type StartCheckoutInput,
} from "../domain/checkout";

const uuidSchema = z.string().trim().uuid();
const addressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  recipientName: z.string().trim().min(2).max(120),
  phone: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().regex(/^\d{10,15}$/)),
  postalCode: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().regex(/^\d{8}$/)),
  street: z.string().trim().min(2).max(160),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().min(1).max(100).nullable().optional(),
  neighborhood: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  isDefault: z.boolean().optional(),
});
const checkoutSchema = z.object({
  addressId: uuidSchema,
  paymentMethod: z.enum(["PIX", "CREDIT_CARD"]),
  installments: z.number().int().min(1).max(10),
});

export class CheckoutService {
  constructor(
    private readonly repository: CheckoutRepository,
    private readonly session: CheckoutSession,
  ) {}

  private async userId(): Promise<string> {
    const userId = await this.session.currentUserId();
    if (!userId) throw new CheckoutAuthenticationError();
    return userId;
  }

  async listAddresses(): Promise<readonly CustomerAddress[]> {
    return this.repository.listAddresses(await this.userId());
  }

  async createAddress(input: CreateAddressInput): Promise<CustomerAddress> {
    const parsed = addressSchema.safeParse(input);
    if (!parsed.success) throw new CheckoutValidationError("ADDRESS_INVALID");
    return this.repository.createAddress(await this.userId(), parsed.data);
  }

  async start(input: StartCheckoutInput): Promise<CheckoutDraft> {
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      const paymentInvalid = parsed.error.issues.some((issue) => issue.path[0] === "paymentMethod");
      const installmentsInvalid = parsed.error.issues.some((issue) => issue.path[0] === "installments");
      throw new CheckoutValidationError(
        paymentInvalid ? "PAYMENT_INVALID" : installmentsInvalid ? "INSTALLMENTS_INVALID" : "ADDRESS_INVALID",
      );
    }

    const userId = await this.userId();
    const [address, cart] = await Promise.all([
      this.repository.findAddressById(userId, parsed.data.addressId),
      this.repository.findActiveCart(userId),
    ]);

    if (!address) throw new CheckoutUnavailableError("ADDRESS_NOT_FOUND");
    if (!cart) throw new CheckoutUnavailableError("ACTIVE_CART_NOT_FOUND");
    if (cart.itemCount < 1) throw new CheckoutUnavailableError("EMPTY_CART");

    const existing = await this.repository.findDraftByCart(userId, cart.id);
    return existing
      ? this.repository.updateDraft(existing.id, parsed.data)
      : this.repository.createDraft(cart.id, parsed.data);
  }
}
