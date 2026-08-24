import { WorkspaceRail } from "../components/workspace-rail";

export default function AffiliateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="role-workspace affiliate-workspace-root"><WorkspaceRail area="affiliate" />{children}</div>;
}
