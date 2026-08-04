import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { requireOrderOperator } from "../../../modules/orders/application/authorization";
import type { OrderStatus } from "../../../modules/orders/domain/order";
import { OrderStatusForm } from "./order-status-form";
import "./orders-admin.css";

const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const date=new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Bahia"});
const labels:Record<OrderStatus,string>={PAID:"Pago",PROCESSING:"Em preparação",SHIPPED:"Enviado",DELIVERED:"Entregue",CANCELLED:"Cancelado",REFUNDED:"Estornado"};
const orderFields="id, order_number, user_id, status, payment_method, installments, total_cents, recipient_name, recipient_phone, city, state, tracking_code, shipping_carrier, created_at";
type AdminOrder={id:string;order_number:number;user_id:string;status:OrderStatus;payment_method:"PIX"|"CREDIT_CARD";installments:number;total_cents:number;recipient_name:string;recipient_phone:string;city:string;state:string;tracking_code:string|null;shipping_carrier:string|null;created_at:string};
type ItemRow={order_id:string;product_name:string;quantity:number};
type ProfileRow={user_id:string;name:string;email:string};

export default async function OrdersAdministrationPage(){
  const operator=await requireOrderOperator(await createServerSupabaseClient());
  if(!operator) redirect("/minha-area");
  const admin=createAdminSupabaseClient();
  const {data,error}=await admin.from("orders").select(orderFields).order("created_at",{ascending:false}).limit(200);
  if(error) throw error;
  const orders=(data??[]) as AdminOrder[];
  const orderIds=orders.map(order=>order.id),userIds=[...new Set(orders.map(order=>order.user_id))];
  const [itemsResult,profilesResult]=await Promise.all([
    orderIds.length?admin.from("order_items").select("order_id, product_name, quantity").in("order_id",orderIds):Promise.resolve({data:[] as ItemRow[],error:null}),
    userIds.length?admin.from("profiles").select("user_id, name, email").in("user_id",userIds):Promise.resolve({data:[] as ProfileRow[],error:null}),
  ]);
  if(itemsResult.error) throw itemsResult.error; if(profilesResult.error) throw profilesResult.error;
  const items=(itemsResult.data??[]) as ItemRow[],profiles=(profilesResult.data??[]) as ProfileRow[];
  const profileByUser=new Map(profiles.map(profile=>[profile.user_id,profile]));
  const counts=orders.reduce<Record<string,number>>((result,order)=>{result[order.status]=(result[order.status]??0)+1;return result;},{});
  return <main className="admin-orders"><header><Link href="/" className="admin-orders-brand"><b>BE</b>YOU<small>Administração</small></Link><nav><Link href="/admin/produtos">Produtos</Link><Link className="active" href="/admin/pedidos">Pedidos</Link><Link href="/minha-area">Minha área</Link></nav></header><div className="admin-orders-container"><section className="admin-orders-title"><div><small>FASE 06 · ORDERS</small><h1>Gestão de pedidos</h1><p>Atualize expedição e entrega com histórico auditável.</p></div><span>{orders.length} pedidos</span></section><section className="admin-order-stats">{(["PAID","PROCESSING","SHIPPED","DELIVERED"] as OrderStatus[]).map(status=><article key={status}><small>{labels[status]}</small><strong>{counts[status]??0}</strong></article>)}</section><section className="admin-order-list">{orders.map(order=>{const profile=profileByUser.get(order.user_id);const orderItems=items.filter(item=>item.order_id===order.id);return <details className="admin-order" key={order.id}><summary><div><span className={`admin-order-status ${order.status.toLowerCase()}`}>{labels[order.status]}</span><h2>Pedido #{order.order_number}</h2><p>{profile?.name??order.recipient_name} · {date.format(new Date(order.created_at))}</p></div><div><strong>{money.format(order.total_cents/100)}</strong><small>{orderItems.length} {orderItems.length===1?"produto":"produtos"}</small></div><b>Gerenciar</b></summary><div className="admin-order-body"><section><h3>Cliente e pedido</h3><p><b>{profile?.name??order.recipient_name}</b><br/>{profile?.email??"E-mail não disponível"}<br/>{order.recipient_phone}<br/>{order.city}/{order.state}</p><div className="admin-order-products">{orderItems.map((item,index)=><span key={`${item.product_name}-${index}`}>{item.quantity}× {item.product_name}</span>)}</div><p>Pagamento: <b>{order.payment_method==="PIX"?"Pix":`${order.installments}x no cartão`}</b></p>{order.tracking_code&&<p>Rastreamento: <b>{order.shipping_carrier} · {order.tracking_code}</b></p>}</section><section><h3>Atualizar andamento</h3><OrderStatusForm orderId={order.id} status={order.status} canReverse={operator.role!=="SUPORTE"}/></section></div></details>;})}{orders.length===0&&<div className="admin-orders-empty">Nenhum pedido confirmado até o momento.</div>}</section></div></main>;
}
