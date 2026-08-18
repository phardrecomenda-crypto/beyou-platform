"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export type AuthState = { error?: string; success?: string };

const credentialsSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({ email: value(formData, "email"), password: value(formData, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos." };
  redirect("/minha-area");
}

export async function signUpAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const name = value(formData, "name");
  const password = value(formData, "password");
  const confirmation = value(formData, "confirmPassword");
  const acceptedTerms = formData.get("acceptedTerms") === "on";
  const parsed = credentialsSchema.safeParse({ email: value(formData, "email"), password });
  if (name.length < 3) return { error: "Informe seu nome completo." };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (password !== confirmation) return { error: "As senhas não coincidem." };
  if (!acceptedTerms) return { error: "Você precisa aceitar os termos de uso." };

  const supabase = await createServerSupabaseClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { data: { full_name: name }, emailRedirectTo: `${origin}/auth/callback?next=/minha-area` },
  });
  if (error) return { error: error.message.includes("registered") ? "Este e-mail já possui cadastro." : "Não foi possível criar sua conta." };
  return { success: "Cadastro realizado. Confira seu e-mail para confirmar a conta." };
}

export async function requestPasswordResetAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.email().safeParse(value(formData, "email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${origin}/auth/callback?next=/redefinir-senha` });
  if (error) return { error: "Não foi possível enviar o e-mail agora." };
  return { success: "Se o e-mail estiver cadastrado, você receberá o link de recuperação." };
}

export async function updatePasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = value(formData, "password");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== value(formData, "confirmPassword")) return { error: "As senhas não coincidem." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "O link expirou ou não foi possível atualizar a senha." };
  redirect("/login?updated=1");
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
