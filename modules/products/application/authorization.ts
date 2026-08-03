import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireProductAdministrator(client: SupabaseClient) {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return false;
  const { data, error } = await client.from("profiles").select("role, status").eq("user_id", userData.user.id).maybeSingle();
  if (error || !data) return false;
  return data.status === "ACTIVE" && (data.role === "SUPER_ADMIN" || data.role === "ADMIN");
}
