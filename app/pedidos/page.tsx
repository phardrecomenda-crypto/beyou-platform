import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { OrderAuthenticationError } from "../../modules/orders/domain/order";
import { createOrderService } from "../../modules/orders/infrastructure/order-factory";
import { OrderCard, OrdersHeader } from "./order-view";
import "./orders.css";

export default async function OrdersPage() {
  let orders;
  try {
    orders = await createOrderService(await createServerSupabaseClient()).listMine();
  } catch(error) {
    if(error instanceof OrderAuthenticationError) redirect("/login?next=%2Fpedidos");
    throw error;
  }
  return <main className="orders-page"><OrdersHeader /><div className="orders-container"><section className="orders-title"><small>SUA HISTÓRIA BEYOU</small><h1>Meus pedidos</h1><p>Acompanhe pagamentos, preparação e entrega em um só lugar.</p></section>{orders.length>0?<div className="orders-list">{orders.map((order)=><OrderCard key={order.id} order={order} />)}</div>:<section className="orders-empty"><span>◇</span><h2>Você ainda não tem pedidos.</h2><p>Quando um pagamento for confirmado, seu pedido aparecerá aqui.</p><Link href="/loja">Conhecer produtos</Link></section>}</div></main>;
}
