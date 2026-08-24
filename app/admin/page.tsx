import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import "../platform-tools.css";
import "./admin-dashboard.css";

const roles = ["admin", "super_admin", "support", "finance"];

export default async function AdminHome() {
  const session = await createServerSupabaseClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin.from("profiles").select("role,full_name").eq("id", user.id).single();
  if (!profile || !roles.includes(profile.role)) redirect("/minha-area");

  const [users, products, orders, tickets, affiliates, network, ai] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("products").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }),
    admin.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"]),
    admin.from("affiliate_profiles").select("user_id", { count: "exact", head: true }).eq("active", true),
    admin.from("affiliate_network").select("id", { count: "exact", head: true }).eq("active", true),
    admin.from("ai_generations").select("id", { count: "exact", head: true }).eq("status", "REVIEW_REQUIRED"),
  ]);
  const cards = [
    { label: "Usuários", value: users.count ?? 0, href: "/admin/usuarios", roles: ["super_admin"] },
    { label: "Produtos", value: products.count ?? 0, href: "/admin/produtos", roles: ["admin", "super_admin"] },
    { label: "Pedidos", value: orders.count ?? 0, href: "/admin/pedidos", roles: ["admin", "super_admin", "support"] },
    { label: "Atendimentos abertos", value: tickets.count ?? 0, href: "/admin/suporte", roles: ["admin", "super_admin", "support"] },
    { label: "Afiliados ativos", value: affiliates.count ?? 0, href: "/admin/afiliados", roles: ["admin", "super_admin"] },
    { label: "Vínculos da rede", value: network.count ?? 0, href: "/admin/rede", roles: ["admin", "super_admin"] },
    { label: "Planos em revisão", value: ai.count ?? 0, href: "/admin/ia", roles: ["admin", "super_admin"] },
  ].filter((item) => item.roles.includes(profile.role));

  return <main className="tool-page">
    <header className="tool-header"><Link className="tool-brand" href="/"><b>BE</b>YOU <span>Admin</span></Link><nav className="tool-nav" aria-label="Central administrativa"><Link className="active" href="/admin">Visão geral</Link>{profile.role === "super_admin" && <Link href="/admin/usuarios">Usuários</Link>}<Link href="/admin/produtos">Produtos</Link><Link href="/admin/pedidos">Pedidos</Link><Link href="/admin/afiliados">Afiliados</Link><Link href="/admin/rede">Rede</Link><Link href="/admin/crm">CRM</Link><Link href="/admin/suporte">Atendimento</Link><Link href="/admin/financeiro">Financeiro</Link>{["admin", "super_admin"].includes(profile.role) && <Link href="/admin/ia">Planos IA</Link>}<Link href="/minha-area">Área do cliente</Link><Link href="/loja">Ver loja</Link></nav></header>
    <div className="tool-main"><section className="tool-title"><small>CENTRAL OPERACIONAL</small><h1>Olá, {profile.full_name?.split(" ")[0] ?? "equipe"}.</h1><p>Produtos, clientes, pedidos, atendimento, afiliados, financeiro e inteligência em uma única visão.</p></section><section className="tool-grid">{cards.map((item) => <Link className="tool-card third admin-module-link" href={item.href} key={item.label}><small>{item.label}</small><div className="tool-stat">{item.value}</div><span>Abrir módulo →</span></Link>)}<article className="tool-card wide"><h2>Atalhos operacionais</h2><div className="tool-actions"><Link className="tool-primary" href="/admin/pedidos">Gerenciar pedidos</Link><Link className="tool-primary" href="/admin/suporte">Abrir fila de atendimento</Link><Link className="tool-primary" href="/admin/crm">Ver jornada dos clientes</Link>{["admin", "super_admin"].includes(profile.role) && <Link className="tool-primary" href="/admin/ia">Revisar planos</Link>}</div></article></section></div>
  </main>;
}
