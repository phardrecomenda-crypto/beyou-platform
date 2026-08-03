export const CART_STATUSES = ["ACTIVE", "CONVERTED", "ABANDONED", "EXPIRED"] as const;

export type CartStatus = (typeof CART_STATUSES)[number];

export type CartItem = Readonly<{
  id: string;
  cartId: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPriceCents: number;
  quantity: 1;
  lineTotalCents: number;
  createdAt: string;
  updatedAt: string;
}>;

export type CartSummary = Readonly<{
  itemCount: number;
  subtotalCents: number;
  freeShippingRemainingCents: number;
  qualifiesForFreeShipping: boolean;
}>;

export type Cart = Readonly<{
  id: string;
  userId: string;
  status: CartStatus;
  currency: "BRL";
  items: readonly CartItem[];
  summary: CartSummary;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export const FREE_SHIPPING_THRESHOLD_CENTS = 60_000;

export class CartAuthenticationError extends Error {
  constructor() {
    super("AUTHENTICATION_REQUIRED");
    this.name = "CartAuthenticationError";
  }
}

export class CartConflictError extends Error {
  constructor(public readonly code: "ACTIVE_CART_ALREADY_EXISTS") {
    super(code);
    this.name = "CartConflictError";
  }
}

export class CartUnavailableError extends Error {
  constructor(public readonly code: "PRODUCT_UNAVAILABLE" | "ACTIVE_CART_NOT_FOUND") {
    super(code);
    this.name = "CartUnavailableError";
  }
}
