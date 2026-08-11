import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { AffiliateError } from "../../../modules/affiliates/domain/affiliate";
import { createAffiliateService } from "../../../modules/affiliates/infrastructure/affiliate-factory";
import { reviewAffiliateApplicationAction } from "../../afiliados/actions";
import "../../afiliados/affiliate.css";

const date=new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeZone:"America/Bahia"});
export default async function AffiliateAdminPage(){
  const client=await createServerSupabaseClient(),service=createAffiliateService(client,createAdminSupabaseClient());
  let applications;
  try{applications=await service.pendingApplications();}catch(error){if(error instanceof AffiliateError&&(error.code==="AUTHENTICATION_REQUIRED"||error.code==="ADMIN_REQUIRED"))redirect("/minha-area");throw error;}
  return <main className="affiliate-shell admin-affiliates"><header className="affiliate-header"><Link href="/" className="affiliate-brand"><b>BE</b>YOU <small>Admin</small></Link><nav><Link href="/admin/pedidos">Pedidos</Link><Link href="/minha-area">Minha área</Link></nav></header><section className="dashboard-title"><div><small>AFFILIATE ENGINE</small><h1>Solicitações de afiliados</h1><p>Aprovação protegida, auditável e sem ativação automática.</p></div><span>{applications.length} pendentes</span></section><section className="application-list">{applications.map(item=><article className="affiliate-card" key={item.id}><div><small>{date.format(new Date(item.createdAt))}</small><h2>{item.applicantName}</h2><p>{item.notes}</p></div><form action={reviewAffiliateApplicationAction}><input type="hidden" name="applicationId" value={item.id}/><label>Observação da análise<textarea name="reviewNotes" maxLength={1000}/></label><div><button name="decision" value="approved">Aprovar</button><button className="secondary" name="decision" value="rejected">Recusar</button></div></form></article>)}{!applications.length&&<div className="affiliate-card empty"><h2>Tudo em dia.</h2><p>Não há solicitações aguardando análise.</p></div>}</section></main>;
}
