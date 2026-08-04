import type { Order } from "../domain/order";

export interface OrderSession {
  currentUserId(): Promise<string | null>;
}

export interface OrderRepository {
  listByUser(userId: string): Promise<readonly Order[]>;
  findById(userId: string, orderId: string): Promise<Order | null>;
}
