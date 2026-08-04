export type OrderStatus = "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

export type OrderItem = Readonly<{
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}>;

export type OrderHistoryEntry = Readonly<{
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  createdAt: string;
}>;

export type Order = Readonly<{
  id: string;
  orderNumber: number;
  status: OrderStatus;
  paymentMethod: "PIX" | "CREDIT_CARD";
  installments: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  trackingCode: string | null;
  shippingCarrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  paidAt: string;
  createdAt: string;
  items: readonly OrderItem[];
  history: readonly OrderHistoryEntry[];
}>;

export class OrderAuthenticationError extends Error {
  constructor() {
    super("AUTHENTICATION_REQUIRED");
    this.name = "OrderAuthenticationError";
  }
}
