import Link from "next/link";
import type { Order, OrderStatus } from "../../modules/orders/domain/order";

const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const dateTime=new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Bahia"});
const labels:Record<OrderStatus,string>={ PAID:"Pagamento aprovado",PROCESSING:"Em preparação",SHIPPED:"Enviado",DELIVERED:"Entregue",CANCELLED:"Cancelado",REFUNDED:"Estornado" };
const steps:OrderStatus[]=["PAID","PROCESSING","SHIPPED","DELIVERED"];

export function OrdersHeader() {
  return <header className="orders-header"><Link className="orders-brand" href="/minha-area"><span>BE</span>YOU<small>Nutrition</small></Link><nav><Link href="/minha-area">Minha área</Link><Link className="active" href="/pedidos">Meus pedidos</Link><Link href="/loja">Loja</Link></nav></header>;
}

export function StatusPill({ status }: Readonly<{status:OrderStatus}>) {
  return <span className={`order-status status-${status.toLowerCase()}`}>{labels[status]}</span>;
}

export function OrderCard({ order }: Readonly<{order:Order}>) {
  return <article className="order-card"><div className="order-card-top"><div><small>PEDIDO</small><h2>#{order.orderNumber}</h2></div><StatusPill status={order.status} /></div><p>{dateTime.format(new Date(order.createdAt))} · {order.items.length} {order.items.length===1?"produto":"produtos"}</p><div className="order-card-items">{order.items.map((item)=><span key={item.id}>{item.productName}</span>)}</div><div className="order-card-bottom"><strong>{money.format(order.totalCents/100)}</strong><Link href={`/pedidos/${order.id}`}>Ver detalhes <b>→</b></Link></div></article>;
}

export function OrderDetails({ order, confirmed=false }: Readonly<{order:Order;confirmed?:boolean}>) {
  const currentIndex=steps.indexOf(order.status);
  return <main className="orders-page"><OrdersHeader /><div className="orders-container">
    {confirmed && <section className="confirmation-hero"><span aria-hidden="true">✓</span><small>PAGAMENTO CONFIRMADO</small><h1>Pedido realizado com sucesso.</h1><p>O pedido #{order.orderNumber} já está registrado e você pode acompanhar cada atualização por aqui.</p></section>}
    <div className="order-detail-heading"><div><small>DETALHES DO PEDIDO</small><h1>Pedido #{order.orderNumber}</h1><p>Realizado em {dateTime.format(new Date(order.createdAt))}</p></div><StatusPill status={order.status} /></div>
    {!(["CANCELLED","REFUNDED"] as OrderStatus[]).includes(order.status) && <ol className="order-timeline" aria-label="Andamento do pedido">{steps.map((step,index)=><li key={step} className={index<=currentIndex?"done":""}><span>{index<currentIndex?"✓":index+1}</span><b>{labels[step]}</b></li>)}</ol>}
    <div className="order-detail-grid"><section className="order-panel"><h2>Produtos</h2>{order.items.map((item)=><article className="order-line" key={item.id}><div className="order-product-mark"><small>BE</small><b>YOU</b></div><div><strong>{item.productName}</strong><span>SKU {item.productSku} · {item.quantity} unidade</span></div><b>{money.format(item.lineTotalCents/100)}</b></article>)}<dl className="order-totals"><div><dt>Subtotal</dt><dd>{money.format(order.subtotalCents/100)}</dd></div>{order.discountCents>0&&<div className="discount"><dt>Desconto</dt><dd>- {money.format(order.discountCents/100)}</dd></div>}<div><dt>Entrega</dt><dd>{order.shippingCents===0?"Grátis":money.format(order.shippingCents/100)}</dd></div><div className="total"><dt>Total</dt><dd>{money.format(order.totalCents/100)}</dd></div></dl></section>
      <aside><section className="order-panel"><h2>Pagamento</h2><p><b>{order.paymentMethod==="PIX"?"Pix":"Cartão de crédito"}</b><br />{order.paymentMethod==="CREDIT_CARD"?`${order.installments}x sem juros`:"Pagamento à vista"}</p><small>Confirmado em {dateTime.format(new Date(order.paidAt))}</small></section><section className="order-panel"><h2>Entrega</h2><p><b>{order.recipientName}</b><br />{order.street}, {order.addressNumber}{order.addressComplement?`, ${order.addressComplement}`:""}<br />{order.neighborhood} · {order.city}/{order.state}<br />CEP {order.postalCode}</p></section></aside></div>
      {order.trackingCode&&<section className="order-panel order-tracking"><h2>Rastreamento</h2><p><b>{order.shippingCarrier}</b><br />Código: <strong>{order.trackingCode}</strong></p></section>}
    <div className="orders-actions"><Link href="/pedidos">Todos os pedidos</Link><Link className="primary" href="/loja">Continuar comprando</Link></div>
  </div></main>;
}
