import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { OrderAuthenticationError } from "../../../modules/orders/domain/order";
import { createOrderService } from "../../../modules/orders/infrastructure/order-factory";
import { OrderDetails } from "../../pedidos/order-view";
import "../../pedidos/orders.css";

export default async function ConfirmedOrderPage({ searchParams }: Readonly<{searchParams:Promise<{pedido?:string}>}>) {
  const {pedido}=await searchParams;
  if(!pedido) redirect("/pedidos");
  try {
    const order=await createOrderService(await createServerSupabaseClient()).getMine(pedido);
    if(!order) notFound();
    return <OrderDetails order={order} confirmed />;
  } catch(error) {
    if(error instanceof OrderAuthenticationError) redirect(`/login?next=${encodeURIComponent(`/pedido/confirmado?pedido=${pedido}`)}`);
    throw error;
  }
}
