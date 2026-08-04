import type { SupabaseClient } from "@supabase/supabase-js";

export type OrderOperatorRole = "SUPER_ADMIN" | "ADMIN" | "SUPORTE";

export async function requireOrderOperator(client: SupabaseClient) {
  const { data:userData, error:userError }=await client.auth.getUser();
  if(userError || !userData.user) return null;
  const { data, error }=await client.from("profiles").select("role, status").eq("user_id",userData.user.id).maybeSingle();
  if(error || !data || data.status!=="ACTIVE" || !["SUPER_ADMIN","ADMIN","SUPORTE"].includes(data.role)) return null;
  return { userId:userData.user.id, role:data.role as OrderOperatorRole };
}
