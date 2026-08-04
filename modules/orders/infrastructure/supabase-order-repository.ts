import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderRepository, OrderSession } from "../application/order-repository";
import type { Order, OrderHistoryEntry, OrderItem, OrderStatus } from "../domain/order";

const orderFields = "id, order_number, status, payment_method, installments, subtotal_cents, discount_cents, shipping_cents, total_cents, recipient_name, recipient_phone, postal_code, street, address_number, address_complement, neighborhood, city, state, tracking_code, shipping_carrier, shipped_at, delivered_at, paid_at, created_at";
const itemFields = "id, order_id, product_id, product_name, product_sku, unit_price_cents, quantity, line_total_cents";
const historyFields = "id, order_id, from_status, to_status, created_at";

type OrderRow = { id:string; order_number:number; status:OrderStatus; payment_method:"PIX"|"CREDIT_CARD"; installments:number; subtotal_cents:number; discount_cents:number; shipping_cents:number; total_cents:number; recipient_name:string; recipient_phone:string; postal_code:string; street:string; address_number:string; address_complement:string|null; neighborhood:string; city:string; state:string; tracking_code:string|null; shipping_carrier:string|null; shipped_at:string|null; delivered_at:string|null; paid_at:string; created_at:string };
type ItemRow = { id:string; order_id:string; product_id:string; product_name:string; product_sku:string; unit_price_cents:number; quantity:number; line_total_cents:number };
type HistoryRow = { id:string; order_id:string; from_status:OrderStatus|null; to_status:OrderStatus; created_at:string };

const mapItem = (row: ItemRow): OrderItem => ({ id:row.id, productId:row.product_id, productName:row.product_name, productSku:row.product_sku, unitPriceCents:row.unit_price_cents, quantity:row.quantity, lineTotalCents:row.line_total_cents });
const mapHistory = (row: HistoryRow): OrderHistoryEntry => ({ id:row.id, fromStatus:row.from_status, toStatus:row.to_status, createdAt:row.created_at });
const mapOrder = (row: OrderRow, items: readonly ItemRow[], history: readonly HistoryRow[]): Order => ({
  id:row.id, orderNumber:row.order_number, status:row.status, paymentMethod:row.payment_method,
  installments:row.installments, subtotalCents:row.subtotal_cents, discountCents:row.discount_cents,
  shippingCents:row.shipping_cents, totalCents:row.total_cents, recipientName:row.recipient_name,
  recipientPhone:row.recipient_phone, postalCode:row.postal_code, street:row.street,
  addressNumber:row.address_number, addressComplement:row.address_complement, neighborhood:row.neighborhood,
  city:row.city, state:row.state, trackingCode:row.tracking_code, shippingCarrier:row.shipping_carrier,
  shippedAt:row.shipped_at, deliveredAt:row.delivered_at, paidAt:row.paid_at, createdAt:row.created_at,
  items:items.filter((item)=>item.order_id===row.id).map(mapItem),
  history:history.filter((entry)=>entry.order_id===row.id).map(mapHistory),
});

export class SupabaseOrderSession implements OrderSession {
  constructor(private readonly client: SupabaseClient) {}
  async currentUserId() {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw error;
    return data.user?.id ?? null;
  }
}

export class SupabaseOrderRepository implements OrderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByUser(userId: string) {
    const { data, error } = await this.client.from("orders").select(orderFields).eq("user_id", userId).order("created_at", { ascending:false });
    if (error) throw error;
    return this.hydrate((data ?? []) as OrderRow[]);
  }

  async findById(userId: string, orderId: string) {
    const { data, error } = await this.client.from("orders").select(orderFields).eq("id", orderId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return (await this.hydrate([data as OrderRow]))[0] ?? null;
  }

  private async hydrate(rows: readonly OrderRow[]) {
    if (rows.length===0) return [];
    const ids = rows.map((row)=>row.id);
    const [itemsResult, historyResult] = await Promise.all([
      this.client.from("order_items").select(itemFields).in("order_id", ids).order("created_at"),
      this.client.from("order_status_history").select(historyFields).in("order_id", ids).order("created_at"),
    ]);
    if (itemsResult.error) throw itemsResult.error;
    if (historyResult.error) throw historyResult.error;
    const items=(itemsResult.data ?? []) as ItemRow[];
    const history=(historyResult.data ?? []) as HistoryRow[];
    return rows.map((row)=>mapOrder(row,items,history));
  }
}
