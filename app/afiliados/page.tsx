import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { AffiliateError } from "../../modules/affiliates/domain/affiliate";
import { createAffiliateService } from "../../modules/affiliates/infrastructure/affiliate-factory";
import { submitAffiliateApplicationAction } from "./actions";
import "./affiliate.css";

const status={pending:"Em análise",approved:"Aprovada",rejected:"Não aprovada"};
export default async function AffiliatesPage(){
  const client=await createServerSupabaseClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user) redirect("/login?next=%2Fafiliados");
  const service=createAffiliateService(client);
  try{await service.dashboard();redirect("/afiliados/painel");}catch(error){if(!(error instanceof AffiliateError)||error.code!=="AFFILIATE_NOT_ACTIVE")throw error;}
  const application=await service.application();
  return <main className="affiliate-shell"><header className="affiliate-header"><Link href="/" className="affiliate-brand"><b>BE</b>YOU</Link><Link href="/minha-area">Minha área</Link></header><section className="affiliate-hero"><small>PROGRAMA DE AFILIADOS</small><h1>Transforme influência em impacto.</h1><p>Indique os protocolos BEYOU, acompanhe resultados reais e construa sua rede com transparência.</p></section><section className="affiliate-card">{application?<div className={`affiliate-status ${application.status}`}><span>{status[application.status]}</span><h2>Sua solicitação está {status[application.status].toLowerCase()}.</h2><p>{application.status==="pending"?"Nossa equipe está revisando seus dados. Você verá a atualização nesta página.":application.reviewNotes??"Consulte a equipe BEYOU para mais informações."}</p></div>:<form action={submitAffiliateApplicationAction}><small>PRIMEIRO PASSO</small><h2>Quero ser afiliado BEYOU</h2><label>Conte sobre seu trabalho e como pretende divulgar a BEYOU<textarea name="notes" minLength={20} maxLength={1000} required placeholder="Fale sobre sua audiência, canais e objetivos..."/></label><button type="submit">Enviar solicitação</button></form>}</section><aside className="affiliate-rule"><b>Regra comercial transparente</b><p>A comissão padrão de venda direta é de 20%. A divisão de 15% para o afiliado e 5% para a empresa aplica-se exclusivamente ao remarketing validado.</p></aside></main>;
}
