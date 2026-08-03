import {
  CartAuthenticationError,
  CartConflictError,
  CartUnavailableError,
  type Cart,
} from "../domain/cart";
import type { CartRepository, CartSession } from "./cart-repository";

type DatabaseError = Readonly<{ code?: unknown; message?: unknown }>;

function databaseError(error: unknown): DatabaseError {
  return typeof error === "object" && error !== null ? error as DatabaseError : {};
}

export class CartService {
  constructor(
    private readonly repository: CartRepository,
    private readonly session: CartSession,
  ) {}

  private async userId() {
    const userId = await this.session.currentUserId();
    if (!userId) throw new CartAuthenticationError();
    return userId;
  }

  async getActive(): Promise<Cart | null> {
    return this.repository.findActiveByUser(await this.userId());
  }

  async getOrCreateActive(): Promise<Cart> {
    const userId = await this.userId();
    const existing = await this.repository.findActiveByUser(userId);
    if (existing) return existing;

    try {
      return await this.repository.createActive(userId);
    } catch (error) {
      if (databaseError(error).code !== "23505") throw error;
      const concurrent = await this.repository.findActiveByUser(userId);
      if (concurrent) return concurrent;
      throw new CartConflictError("ACTIVE_CART_ALREADY_EXISTS");
    }
  }

  async addProduct(productId: string): Promise<Cart> {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) throw new CartUnavailableError("PRODUCT_UNAVAILABLE");

    const cart = await this.getOrCreateActive();
    try {
      await this.repository.addItem(cart.id, normalizedProductId);
    } catch (error) {
      const details = databaseError(error);
      if (details.code === "23505") throw new CartConflictError("PRODUCT_ALREADY_IN_CART");
      if (details.message === "PRODUCT_UNAVAILABLE") {
        throw new CartUnavailableError("PRODUCT_UNAVAILABLE");
      }
      throw error;
    }

    const updated = await this.repository.findActiveByUser(cart.userId);
    if (!updated) throw new CartUnavailableError("ACTIVE_CART_NOT_FOUND");
    return updated;
  }

  async removeProduct(productId: string): Promise<Cart> {
    const userId = await this.userId();
    const cart = await this.repository.findActiveByUser(userId);
    if (!cart) throw new CartUnavailableError("ACTIVE_CART_NOT_FOUND");

    await this.repository.removeItem(cart.id, productId);
    const updated = await this.repository.findActiveByUser(userId);
    if (!updated) throw new CartUnavailableError("ACTIVE_CART_NOT_FOUND");
    return updated;
  }
}
