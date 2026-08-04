import { OrderAuthenticationError } from "../domain/order";
import type { OrderRepository, OrderSession } from "./order-repository";

export class OrderService {
  constructor(
    private readonly session: OrderSession,
    private readonly repository: OrderRepository,
  ) {}

  private async requireUser() {
    const userId = await this.session.currentUserId();
    if (!userId) throw new OrderAuthenticationError();
    return userId;
  }

  async listMine() {
    return this.repository.listByUser(await this.requireUser());
  }

  async getMine(orderId: string) {
    return this.repository.findById(await this.requireUser(), orderId);
  }
}
