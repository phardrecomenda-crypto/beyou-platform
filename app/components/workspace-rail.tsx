"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Area = "admin" | "customer" | "affiliate";
type Item = { href: string; label: string; icon: string; exact?: boolean; section?: string };

const navigation: Record<Area, Item[]> = {
  admin: [
    { href: "/admin", label: "Visão geral", icon: "⌂", exact: true, section: "GESTÃO" },
    { href: "/admin/usuarios", label: "Usuários", icon: "◎" },
    { href: "/admin/produtos", label: "Produtos", icon: "◇" },
    { href: "/admin/pedidos", label: "Pedidos", icon: "▤" },
    { href: "/admin/afiliados", label: "Afiliados", icon: "♧" },
    { href: "/admin/rede", label: "Rede", icon: "⌘" },
    { href: "/admin/crm", label: "CRM", icon: "◌", section: "OPERAÇÃO" },
    { href: "/admin/suporte", label: "Atendimento", icon: "?" },
    { href: "/admin/financeiro", label: "Financeiro", icon: "▣" },
    { href: "/admin/ia", label: "Planos IA", icon: "✦" },
  ],
  customer: [
    { href: "/minha-area", label: "Visão geral", icon: "⌂", exact: true, section: "MINHA JORNADA" },
    { href: "/loja", label: "Loja", icon: "◇" },
    { href: "/pedidos", label: "Meus pedidos", icon: "▤" },
    { href: "/minha-area/anamnese", label: "Anamnese", icon: "✦", section: "ACOMPANHAMENTO" },
    { href: "/minha-area/protocolo", label: "Protocolo", icon: "◉" },
    { href: "/minha-area/plano", label: "Meu plano", icon: "▦" },
    { href: "/minha-area/beneficios", label: "BeCoins e avisos", icon: "◆" },
    { href: "/suporte", label: "Atendimento", icon: "?" },
  ],
  affiliate: [
    { href: "/afiliados/painel", label: "Painel", icon: "⌂", section: "MEU NEGÓCIO" },
    { href: "/afiliados/painel#rede", label: "Minha rede", icon: "♧" },
    { href: "/afiliados/painel#divulgacao", label: "Divulgação", icon: "↗" },
    { href: "/afiliados/painel#comissoes", label: "Comissões", icon: "◫" },
    { href: "/afiliados/carteira", label: "Extrato e saques", icon: "▣", section: "FINANCEIRO" },
    { href: "/afiliados", label: "Plano de negócio", icon: "◇", exact: true },
    { href: "/loja", label: "Ver loja", icon: "▱" },
  ],
};

function isActive(pathname: string, item: Item) {
  if (item.href.includes("#")) return false;
  const path = item.href.split("#")[0];
  return item.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

export function WorkspaceRail({ area }: Readonly<{ area: Area }>) {
  const pathname = usePathname();
  return <aside className={`workspace-rail workspace-rail-${area}`}>
    <Link href="/" className="workspace-rail-brand"><span aria-hidden="true">◒</span><b>BeYou</b><small>{area === "admin" ? "Central" : area === "affiliate" ? "Painel do afiliado" : "Nutrition"}</small></Link>
    <nav aria-label={area === "admin" ? "Central administrativa" : area === "affiliate" ? "Portal do afiliado" : "Área do cliente"}>
      {navigation[area].map(item => <div className="workspace-nav-item" key={item.href}>{item.section&&<small>{item.section}</small>}<Link className={isActive(pathname, item) ? "active" : ""} href={item.href}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></Link></div>)}
    </nav>
    <div className="workspace-rail-footer">
      <Link className="workspace-support" href="/suporte"><i>?</i><span>Precisa de ajuda?<b>Suporte</b></span></Link>
      <Link className="workspace-store" href="/loja">Ver loja <b>↗</b></Link>
    </div>
  </aside>;
}
