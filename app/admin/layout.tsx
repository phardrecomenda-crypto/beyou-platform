import { WorkspaceRail } from "../components/workspace-rail";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const client = await createServerSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  const { data: profile } = user ? await client.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  return <div className="role-workspace admin-workspace-root"><WorkspaceRail area="admin" role={profile?.role} />{children}</div>;
}
