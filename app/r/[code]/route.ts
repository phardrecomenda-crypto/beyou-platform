import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "../../../lib/supabase/admin";

export const runtime = "nodejs";
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,47}$/;
const INTERNAL_PATH = /^\/(?!\/)/;

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const code = (await context.params).code.trim().toLowerCase();
  if (!CODE_PATTERN.test(code)) return NextResponse.redirect(new URL("/loja", request.url));

  const admin = createAdminSupabaseClient();
  const { data: link, error } = await admin
    .from("affiliate_links")
    .select("code, destination_path, affiliate_user_id")
    .eq("code", code).eq("active", true).maybeSingle();
  if (error || !link) return NextResponse.redirect(new URL("/loja", request.url));
  const { data: profile } = await admin
    .from("affiliate_profiles").select("active")
    .eq("user_id", link.affiliate_user_id).eq("active", true).maybeSingle();
  if (!profile) return NextResponse.redirect(new URL("/loja", request.url));

  const destination = INTERNAL_PATH.test(link.destination_path) ? link.destination_path : "/loja";
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set("beyou_affiliate_ref", link.code, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
