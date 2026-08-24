"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "./actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string };
type Props = { title: string; subtitle: string; submitLabel: string; action: (state: AuthState, data: FormData) => Promise<AuthState>; fields: Field[]; hiddenFields?:Record<string,string>; terms?: boolean; footer: React.ReactNode };

export function AuthForm({ title, subtitle, submitLabel, action, fields, hiddenFields, terms, footer }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return <main className="auth-page"><section className="auth-aside"><Link href="/" className="auth-logo"><b>BE</b>YOU <small>Nutrition</small></Link><div><span>✦</span><p className="auth-kicker">ECOSSISTEMA BEYOU</p><h2>Seja você na sua<br />melhor versão.</h2><p>Ciência, tecnologia, acompanhamento e comunidade em um só lugar.</p></div></section><section className="auth-content"><div className="auth-card"><Link href="/" className="auth-mobile-logo">BE<span>YOU</span></Link><p className="eyebrow">BEM-VINDO À BEYOU</p><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p><form action={formAction}>{Object.entries(hiddenFields??{}).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}{fields.map((field) => <label key={field.name}>{field.label}<input name={field.name} type={field.type ?? "text"} autoComplete={field.autoComplete} required /></label>)}{terms && <label className="terms"><input name="acceptedTerms" type="checkbox" /> <span>Li e aceito os <Link href="/termos">Termos de Uso</Link> e a Política de Privacidade.</span></label>}{state.error && <p className="form-message error" role="alert">{state.error}</p>}{state.success && <p className="form-message success" role="status">{state.success}</p>}<button className="auth-submit" disabled={pending}>{pending ? "Aguarde…" : submitLabel}<span>→</span></button></form><div className="auth-footer">{footer}</div></div></section></main>;
}
