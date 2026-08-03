import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cart, CartItem, CartStatus, CartSummary } from "../domain/cart";
import type { CartRepository, CartSession } from "../application/cart-repository";

const cartFields = "id, user_id, status, currency, expires_at, created_at, updated_at";
const itemFields = "id, cart_id, product_id, product_name, product_sku, unit_price_cents, quantity, line_total_cents, created_at, updated_at";
const summaryFields = "item_count, subtotal_cents, free_shipping_remaining_cents, qualifies_for_free_shipping";

type CartRow = {
  id: string;
  user_id: string;
  status: CartStatus;
  currency: "BRL";
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type CartItemRow = {
  id: string;
  cart_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  unit_price_cents: number;
  quantity: 1;
  line_total_cents: number;
  created_at: string;
  updated_at: string;
};

type CartSummaryRow = {
  item_count: number;
  subtotal_cents: number;
  free_shipping_remaining_cents: number;
  qualifies_for_free_shipping: boolean;
};

function mapItem(row: CartItemRow): CartItem {
  return {
    id: row.id,
    cartId: row.cart_id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    unitPriceCents: row.unit_price_cents,
    quantity: row.quantity,
    lineTotalCents: row.line_total_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSummary(row: CartSummaryRow | null): CartSummary {
  return {
    itemCount: row?.item_count ?? 0,
    subtotalCents: row?.subtotal_cents ?? 0,
    freeShippingRemainingCents: row?.free_shipping_remaining_cents ?? 60_000,
    qualifiesForFreeShipping: row?.qualifies_for_free_shipping ?? false,
  };
}

export class SupabaseCartSession implements CartSession {
  constructor(private readonly client: SupabaseClient) {}

  async currentUserId() {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw error;
    return data.user?.id ?? null;
  }
}

export class SupabaseCartRepository implements CartRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async hydrate(row: CartRow): Promise<Cart> {
    const [itemsResult, summaryResult] = await Promise.all([
      this.client.from("cart_items").select(itemFields).eq("cart_id", row.id).order("created_at"),
      this.client.from("cart_summaries").select(summaryFields).eq("cart_id", row.id).maybeSingle(),
    ]);

    if (itemsResult.error) throw itemsResult.error;
    if (summaryResult.error) throw summaryResult.error;

    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      currency: row.currency,
      items: ((itemsResult.data ?? []) as CartItemRow[]).map(mapItem),
      summary: mapSummary(summaryResult.data as CartSummaryRow | null),
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findActiveByUser(userId: string) {
    const { data, error } = await this.client
      .from("carts")
      .select(cartFields)
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (error) throw error;
    return data ? this.hydrate(data as CartRow) : null;
  }

  async createActive(userId: string) {
    const { data, error } = await this.client
      .from("carts")
      .insert({ user_id: userId })
      .select(cartFields)
      .single();

    if (error) throw error;
    return this.hydrate(data as CartRow);
  }

  async addItem(cartId: string, productId: string) {
    const { error } = await this.client
      .from("cart_items")
      .insert({ cart_id: cartId, product_id: productId, quantity: 1 });

    if (error) throw error;
  }

  async removeItem(cartId: string, productId: string) {
    const { error } = await this.client
      .from("cart_items")
      .delete()
      .eq("cart_id", cartId)
      .eq("product_id", productId);

    if (error) throw error;
  }
}
