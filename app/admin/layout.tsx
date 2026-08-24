import { WorkspaceRail } from "../components/workspace-rail";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="role-workspace admin-workspace-root"><WorkspaceRail area="admin" />{children}</div>;
}
