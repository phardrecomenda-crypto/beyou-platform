"use client";

import { useActionState, useState } from "react";
import type { OrderStatus } from "../../../modules/orders/domain/order";
import { updateOrderStatusAction, type OrderActionState } from "./actions";

const initial:OrderActionState={};
const options:Record<OrderStatus,readonly OrderStatus[]>={PAID:["PROCESSING","CANCELLED","REFUNDED"],PROCESSING:["SHIPPED","CANCELLED","REFUNDED"],SHIPPED:["DELIVERED","REFUNDED"],DELIVERED:["REFUNDED"],CANCELLED:[],REFUNDED:[]};
const labels:Record<OrderStatus,string>={PAID:"Pago",PROCESSING:"Em preparação",SHIPPED:"Enviado",DELIVERED:"Entregue",CANCELLED:"Cancelado",REFUNDED:"Estornado"};

export function OrderStatusForm({orderId,status,canReverse}:Readonly<{orderId:string;status:OrderStatus;canReverse:boolean}>){
  const allowed=options[status].filter(value=>canReverse||!["CANCELLED","REFUNDED"].includes(value));
  const [next,setNext]=useState<OrderStatus|"">(allowed[0]??"");
  const [state,action,pending]=useActionState(updateOrderStatusAction,initial);
  if(allowed.length===0) return <p className="admin-order-closed">Nenhuma transição disponível.</p>;
  return <form action={action} className="admin-status-form"><input type="hidden" name="orderId" value={orderId}/><label>Próximo status<select name="nextStatus" value={next} onChange={event=>setNext(event.target.value as OrderStatus)}>{allowed.map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label>{next==="SHIPPED"&&<div className="tracking-fields"><label>Transportadora<input name="shippingCarrier" required maxLength={80}/></label><label>Código de rastreamento<input name="trackingCode" required maxLength={120}/></label></div>}<button type="submit" disabled={pending}>{pending?"Atualizando…":"Confirmar atualização"}</button>{state.error&&<p className="admin-action-error" role="alert">{state.error}</p>}{state.success&&<p className="admin-action-success" role="status">{state.success}</p>}</form>;
}
