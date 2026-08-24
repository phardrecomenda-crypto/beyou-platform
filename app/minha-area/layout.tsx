import Link from "next/link";
import { WorkspaceRail } from "../components/workspace-rail";

export default function CustomerAreaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="role-workspace customer-workspace-root">
    <WorkspaceRail area="customer" />
    {children}
    <Link className="customer-benefits-shortcut" href="/minha-area/beneficios" aria-label="Abrir BeCoins e notificações">◆<span>BeCoins e avisos</span></Link>
  </div>;
}
