"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { requireOrderOperator } from "../../../modules/orders/application/authorization";
import type { OrderStatus } from "../../../modules/orders/domain/order";

export type OrderActionState={ error?:string; success?:string };
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses=new Set<OrderStatus>(["PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"]);

export async function updateOrderStatusAction(_:OrderActionState,formData:FormData):Promise<OrderActionState>{
  const operator=await requireOrderOperator(await createServerSupabaseClient());
  if(!operator) return {error:"Acesso administrativo necessário."};
  const orderId=String(formData.get("orderId")??"");
  const nextStatus=String(formData.get("nextStatus")??"") as OrderStatus;
  const trackingCode=String(formData.get("trackingCode")??"").trim();
  const shippingCarrier=String(formData.get("shippingCarrier")??"").trim();
  if(!uuid.test(orderId)||!statuses.has(nextStatus)) return {error:"Atualização inválida."};
  if(operator.role==="SUPORTE" && ["CANCELLED","REFUNDED"].includes(nextStatus)) return {error:"Cancelamentos e estornos exigem um administrador."};
  if(nextStatus==="SHIPPED"&&(!trackingCode||!shippingCarrier)) return {error:"Informe transportadora e código de rastreamento."};
  const {error}=await createAdminSupabaseClient().rpc("update_order_fulfillment",{p_order_id:orderId,p_next_status:nextStatus,p_actor_id:operator.userId,p_tracking_code:trackingCode||null,p_shipping_carrier:shippingCarrier||null});
  if(error){
    if(error.message.includes("ORDER_TRANSITION_INVALID")) return {error:"Essa mudança de status não é permitida."};
    if(error.message.includes("TRACKING_REQUIRED")) return {error:"O rastreamento é obrigatório para pedidos enviados."};
    return {error:"Não foi possível atualizar o pedido."};
  }
  revalidatePath("/admin/pedidos"); revalidatePath(`/pedidos/${orderId}`); revalidatePath("/pedidos");
  return {success:"Pedido atualizado e registrado no histórico."};
}
