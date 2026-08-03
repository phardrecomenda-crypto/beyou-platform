import type { Cart } from "../domain/cart";

export interface CartRepository {
  findActiveByUser(userId: string): Promise<Cart | null>;
  createActive(userId: string): Promise<Cart>;
  addItem(cartId: string, productId: string): Promise<void>;
  removeItem(cartId: string, productId: string): Promise<void>;
}

export interface CartSession {
  currentUserId(): Promise<string | null>;
}
