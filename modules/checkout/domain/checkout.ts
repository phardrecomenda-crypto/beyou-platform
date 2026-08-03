export const CHECKOUT_PAYMENT_METHODS = ["PIX", "CREDIT_CARD"] as const;
export const CHECKOUT_STATUSES = ["DRAFT", "READY", "PROCESSING", "COMPLETED", "EXPIRED"] as const;

export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number];
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

export type CustomerAddress = Readonly<{
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type CheckoutDraft = Readonly<{
  id: string;
  userId: string;
  cartId: string;
  addressId: string;
  status: CheckoutStatus;
  paymentMethod: CheckoutPaymentMethod;
  installments: number;
  currency: "BRL";
  subtotalCents: number;
  pixDiscountCents: number;
  shippingCents: number | null;
  totalCents: number | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateAddressInput = Readonly<{
  label: string;
  recipientName: string;
  phone: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault?: boolean;
}>;

export type StartCheckoutInput = Readonly<{
  addressId: string;
  paymentMethod: CheckoutPaymentMethod;
  installments: number;
}>;

export class CheckoutAuthenticationError extends Error {
  constructor() {
    super("AUTHENTICATION_REQUIRED");
    this.name = "CheckoutAuthenticationError";
  }
}

export class CheckoutValidationError extends Error {
  constructor(
    public readonly code:
      | "ADDRESS_INVALID"
      | "PAYMENT_INVALID"
      | "INSTALLMENTS_INVALID",
  ) {
    super(code);
    this.name = "CheckoutValidationError";
  }
}

export class CheckoutUnavailableError extends Error {
  constructor(
    public readonly code:
      | "ACTIVE_CART_NOT_FOUND"
      | "EMPTY_CART"
      | "ADDRESS_NOT_FOUND"
      | "DRAFT_NOT_FOUND",
  ) {
    super(code);
    this.name = "CheckoutUnavailableError";
  }
}
