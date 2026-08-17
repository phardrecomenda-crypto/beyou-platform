import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutRepository, CheckoutSession } from "../application/checkout-repository";
import type {
  CheckoutDraft,
  CheckoutCustomer,
  CheckoutPaymentMethod,
  CheckoutStatus,
  CreateAddressInput,
  CustomerAddress,
  StartCheckoutInput,
} from "../domain/checkout";

const addressFields = "id, user_id, label, postal_code, street, address_number, complement, province, city, state, is_default, created_at, updated_at";
const draftFields = "id, user_id, cart_id, address_id, status, payment_method, installments, currency, subtotal_cents, pix_discount_cents, shipping_cents, total_cents, expires_at, created_at, updated_at";

type AddressRow = {
  id: string; user_id: string; label: string;
  postal_code: string; street: string; address_number: string;
  complement: string | null; province: string; city: string; state: string;
  is_default: boolean; created_at: string; updated_at: string;
};
type DraftRow = {
  id: string; user_id: string; cart_id: string; address_id: string;
  status: CheckoutStatus; payment_method: CheckoutPaymentMethod; installments: number;
  currency: "BRL"; subtotal_cents: number; pix_discount_cents: number;
  shipping_cents: number | null; total_cents: number | null;
  expires_at: string; created_at: string; updated_at: string;
};
type CartSummaryRow = { cart_id: string; item_count: number };
type ProfileRow = { full_name: string | null; phone: string | null };

const mapAddress = (row: AddressRow, customer: CheckoutCustomer): CustomerAddress => ({
  id: row.id, userId: row.user_id, label: row.label, recipientName: customer.name,
  phone: customer.phone ?? "", postalCode: row.postal_code, street: row.street, number: row.address_number,
  complement: row.complement, neighborhood: row.province, city: row.city, state: row.state,
  isDefault: row.is_default, createdAt: row.created_at, updatedAt: row.updated_at,
});
const mapDraft = (row: DraftRow): CheckoutDraft => ({
  id: row.id, userId: row.user_id, cartId: row.cart_id, addressId: row.address_id,
  status: row.status, paymentMethod: row.payment_method, installments: row.installments,
  currency: row.currency, subtotalCents: row.subtotal_cents,
  pixDiscountCents: row.pix_discount_cents, shippingCents: row.shipping_cents,
  totalCents: row.total_cents, expiresAt: row.expires_at,
  createdAt: row.created_at, updatedAt: row.updated_at,
});

export class SupabaseCheckoutSession implements CheckoutSession {
  constructor(private readonly client: SupabaseClient) {}
  async currentUserId(): Promise<string | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw error;
    return data.user?.id ?? null;
  }
}

export class SupabaseCheckoutRepository implements CheckoutRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findCustomer(userId: string): Promise<CheckoutCustomer | null> {
    const [{ data, error }, authResult] = await Promise.all([
      this.client.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
      this.client.auth.getUser(),
    ]);
    if (error) throw error;
    const row = data as ProfileRow | null;
    if (!row || authResult.error || authResult.data.user?.id !== userId) return null;
    return { name: row.full_name?.trim() || "Cliente", email: authResult.data.user.email ?? "", phone: row.phone };
  }

  async listAddresses(userId: string) {
    const [customer, result] = await Promise.all([
      this.findCustomer(userId),
      this.client.from("customer_addresses").select(addressFields)
        .eq("user_id", userId).order("is_default", { ascending: false }).order("created_at"),
    ]);
    const { data, error } = result;
    if (error) throw error;
    if (!customer) return [];
    return ((data ?? []) as AddressRow[]).map((row) => mapAddress(row, customer));
  }

  async createAddress(userId: string, input: CreateAddressInput) {
    if (input.isDefault) {
      const { error: unsetError } = await this.client.from("customer_addresses")
        .update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
      if (unsetError) throw unsetError;
    }
    const { data, error } = await this.client.from("customer_addresses").insert({
      label: input.label, postal_code: input.postalCode, street: input.street,
      address_number: input.number, complement: input.complement ?? null, province: input.neighborhood,
      city: input.city, state: input.state, is_default: input.isDefault ?? false,
    }).select(addressFields).single();
    if (error) throw error;
    const { error: profileError } = await this.client.from("profiles").update({
      full_name: input.recipientName,
      phone: input.phone.replace(/\D/g, ""),
    }).eq("id", userId);
    if (profileError) throw profileError;
    return mapAddress(data as AddressRow, {
      name: input.recipientName,
      email: "",
      phone: input.phone,
    });
  }

  async findAddressById(userId: string, addressId: string) {
    const [customer, result] = await Promise.all([
      this.findCustomer(userId),
      this.client.from("customer_addresses").select(addressFields)
        .eq("id", addressId).eq("user_id", userId).maybeSingle(),
    ]);
    const { data, error } = result;
    if (error) throw error;
    return data && customer ? mapAddress(data as AddressRow, customer) : null;
  }

  async findActiveCart(userId: string) {
    const { data, error } = await this.client.from("cart_summaries")
      .select("cart_id, item_count").eq("user_id", userId).eq("status", "ACTIVE").maybeSingle();
    if (error) throw error;
    const row = data as CartSummaryRow | null;
    return row ? { id: row.cart_id, itemCount: row.item_count } : null;
  }

  async findDraftByCart(userId: string, cartId: string) {
    const { data, error } = await this.client.from("checkout_drafts").select(draftFields)
      .eq("user_id", userId).eq("cart_id", cartId).maybeSingle();
    if (error) throw error;
    return data ? mapDraft(data as DraftRow) : null;
  }

  async createDraft(cartId: string, input: StartCheckoutInput) {
    const { data, error } = await this.client.from("checkout_drafts").insert({
      cart_id: cartId, address_id: input.addressId,
      payment_method: input.paymentMethod, installments: input.installments,
    }).select(draftFields).single();
    if (error) throw error;
    return mapDraft(data as DraftRow);
  }

  async updateDraft(draftId: string, input: StartCheckoutInput) {
    const { data, error } = await this.client.from("checkout_drafts").update({
      address_id: input.addressId, payment_method: input.paymentMethod,
      installments: input.installments,
    }).eq("id", draftId).select(draftFields).single();
    if (error) throw error;
    return mapDraft(data as DraftRow);
  }
}
