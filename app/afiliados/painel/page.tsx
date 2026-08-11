import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { AffiliateError } from "../../../modules/affiliates/domain/affiliate";
import { createAffiliateService } from "../../../modules/affiliates/infrastructure/affiliate-factory";
import { createAffiliateLinkAction } from "../actions";
import "../affiliate.css";

const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const date=new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeZone:"America/Bahia"});
export default async function AffiliateDashboardPage(){
  const client=await createServerSupabaseClient(),service=createAffiliateService(client);
  let dashboard;
  try{dashboard=await service.dashboard();}catch(error){if(error instanceof AffiliateError&&error.code==="AUTHENTICATION_REQUIRED")redirect("/login?next=%2Fafiliados%2Fpainel");if(error instanceof AffiliateError&&error.code==="AFFILIATE_NOT_ACTIVE")redirect("/afiliados");throw error;}
  const links=await service.links();
  return <main className="affiliate-shell dashboard"><header className="affiliate-header"><Link href="/" className="affiliate-brand"><b>BE</b>YOU</Link><nav><Link href="/loja">Loja</Link><Link href="/minha-area">Minha área</Link></nav></header><section className="dashboard-title"><div><small>PAINEL DO AFILIADO</small><h1>Olá, parceiro BEYOU.</h1><p>Código principal: <b>{dashboard.profile.affiliateCode}</b></p></div><span className="active-pill">Ativo</span></section><section className="affiliate-metrics"><article><small>A liberar</small><strong>{money.format(dashboard.pendingAmount)}</strong></article><article><small>Disponível</small><strong>{money.format(dashboard.releasedAmount)}</strong></article><article><small>Pago</small><strong>{money.format(dashboard.paidAmount)}</strong></article><article><small>Minha rede</small><strong>{dashboard.networkMembers}</strong></article></section><section className="dashboard-grid"><article className="affiliate-card"><h2>Criar link de divulgação</h2><form action={createAffiliateLinkAction}><label>Destino<input name="destinationPath" defaultValue="/loja" required pattern="/.*"/></label><label>Campanha<input name="campaign" placeholder="ex.: instagram-agosto" maxLength={80}/></label><label>Código personalizado<input name="code" placeholder="opcional" minLength={3} maxLength={48}/></label><button type="submit">Criar link</button></form><div className="link-list">{links.map(link=><p key={link.id}><b>/{link.code}</b><span>{link.destinationPath}{link.campaign?` · ${link.campaign}`:""}</span></p>)}{!links.length&&<p>Nenhum link criado ainda.</p>}</div></article><article className="affiliate-card"><h2>Comissões recentes</h2><div className="commission-list">{dashboard.recentCommissions.map(item=><p key={item.id}><span>{item.type}<small>{date.format(new Date(item.createdAt))}</small></span><b>{money.format(item.amount)}</b></p>)}{!dashboard.recentCommissions.length&&<p>Nenhuma comissão registrada até o momento.</p>}</div></article></section><aside className="affiliate-rule"><b>Como a comissão funciona</b><p>Venda direta: 20% para o afiliado. Somente no remarketing validado: 15% para o afiliado e 5% para a empresa.</p></aside></main>;
}
