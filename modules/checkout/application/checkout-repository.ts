import type {
  CheckoutDraft,
  CheckoutCustomer,
  CreateAddressInput,
  CustomerAddress,
  StartCheckoutInput,
} from "../domain/checkout";

export interface CheckoutSession {
  currentUserId(): Promise<string | null>;
}

export interface CheckoutRepository {
  findCustomer(userId: string): Promise<CheckoutCustomer | null>;
  listAddresses(userId: string): Promise<readonly CustomerAddress[]>;
  createAddress(userId: string, input: CreateAddressInput): Promise<CustomerAddress>;
  findAddressById(userId: string, addressId: string): Promise<CustomerAddress | null>;
  findActiveCart(userId: string): Promise<Readonly<{ id: string; itemCount: number }> | null>;
  findDraftByCart(userId: string, cartId: string): Promise<CheckoutDraft | null>;
  createDraft(cartId: string, input: StartCheckoutInput): Promise<CheckoutDraft>;
  updateDraft(draftId: string, input: StartCheckoutInput): Promise<CheckoutDraft>;
}
