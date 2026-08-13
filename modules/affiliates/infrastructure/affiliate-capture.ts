import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const REF_PATTERN = /^[a-z0-9][a-z0-9_-]{2,47}$/;

export async function captureCartAffiliate(
  adminClient: SupabaseClient,
  cartId: string,
  customerUserId: string,
  rawCode: string | undefined,
) {
  const code = rawCode?.trim().toLowerCase();
  if (!code || !REF_PATTERN.test(code)) return;
  const { data: link, error: linkError } = await adminClient
    .from("affiliate_links").select("id, affiliate_user_id")
    .eq("code", code).eq("active", true).maybeSingle();
  if (linkError) throw linkError;
  if (!link || link.affiliate_user_id === customerUserId) return;
  const { data: profile, error: profileError } = await adminClient
    .from("affiliate_profiles").select("active")
    .eq("user_id", link.affiliate_user_id).eq("active", true).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return;
  const { error } = await adminClient.from("carts").update({
    affiliate_link_id: link.id,
    attribution_captured_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", cartId).eq("user_id", customerUserId).eq("status", "ACTIVE").is("affiliate_link_id", null);
  if (error) throw error;
}
