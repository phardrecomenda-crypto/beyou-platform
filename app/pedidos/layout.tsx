import { WorkspaceRail } from "../components/workspace-rail";

export default function OrdersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="role-workspace customer-workspace-root"><WorkspaceRail area="customer" />{children}</div>;
}
