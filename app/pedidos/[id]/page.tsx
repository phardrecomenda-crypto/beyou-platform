import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { OrderAuthenticationError } from "../../../modules/orders/domain/order";
import { createOrderService } from "../../../modules/orders/infrastructure/order-factory";
import { OrderDetails } from "../order-view";
import "../orders.css";

export default async function OrderPage({ params }: Readonly<{params:Promise<{id:string}>}>) {
  let order;
  try {
    const {id}=await params;
    order=await createOrderService(await createServerSupabaseClient()).getMine(id);
  } catch(error) {
    if(error instanceof OrderAuthenticationError) redirect("/login?next=%2Fpedidos");
    throw error;
  }
  if(!order) notFound();
  return <OrderDetails order={order} />;
}
