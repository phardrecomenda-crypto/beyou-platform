"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "./auth/actions";
import { createBrowserSupabaseClient } from "../lib/supabase/browser";

const navItems = [
  ["Visão geral", "⌂"],
  ["Loja", "◇"],
  ["Meus pedidos", "▤"],
  ["BeCoins", "◉"],
  ["Minha jornada", "✦"],
] as const;

const products = [
  { name: "BeFit", detail: "60 cápsulas", tone: "lime", label: "Energia & rotina" },
  { name: "BeFiber", detail: "210 g · Morango", tone: "violet", label: "Fibras diárias" },
  { name: "BeCalm", detail: "30 ml", tone: "white", label: "Sua pausa da noite" },
] as const;

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [active, setActive] = useState<(typeof navItems)[number][0]>("Visão geral");
  const [notice, setNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: "Cliente BEYOU", role: "CLIENTE" });

  useEffect(() => {
    let activeRequest = true;
    async function loadProfile() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("user_id", authData.user.id)
        .single();
      if (activeRequest && data) setProfile({ name: data.name, role: data.role });
    }
    void loadProfile();
    return () => { activeRequest = false; };
  }, [supabase]);

  const firstName = profile.name.split(" ")[0] || "Cliente";
  const initials = profile.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "BY";
  const roleLabel = profile.role.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

  function choose(section: (typeof navItems)[number][0]) {
    setActive(section);
    if (section === "Loja") {
      router.push("/loja");
      return;
    }
    if (section !== "Visão geral") setNotice(`${section} será conectada ao Supabase no próximo pacote.`);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>BE</span>YOU<i>Nutrition</i></div>
        <nav aria-label="Navegação principal">
          {navItems.map(([label, icon]) => (
            <button key={label} className={active === label ? "nav-item active" : "nav-item"} onClick={() => choose(label)}>
              <b aria-hidden="true">{icon}</b><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="support-card">
          <span>?</span><strong>Precisa de ajuda?</strong>
          <p>Nossa equipe está pronta para você.</p>
          <button onClick={() => setNotice("Atendimento BEYOU selecionado.")}>Falar com o SAC</button>
        </div>
        <form action={logoutAction}><button className="logout" type="submit">↪ <span>Sair da conta</span></button></form>
      </aside>

      <section className="content">
        <header>
          <button className="mobile-brand" aria-label="Início">BE<span>YOU</span></button>
          <label className="search"><span>⌕</span><input aria-label="Buscar" placeholder="Buscar na BEYOU" /></label>
          <div className="header-actions">
            <button aria-label="Notificações" className="icon-button">♢<i /></button>
            <div className="profile"><div className="avatar">{initials}</div><div><strong>{profile.name}</strong><small>{roleLabel} BEYOU</small></div><span>⌄</span></div>
          </div>
        </header>

        <div className="dashboard">
          <section className="welcome">
            <div><p>SUA ROTINA BEYOU</p><h1>Olá, {firstName} <span>✦</span></h1><h2>Hoje é um ótimo dia para cuidar de você.</h2></div>
            <button onClick={() => choose("Loja")}>Ver meus produtos <span>→</span></button>
          </section>

          {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice(null)}>×</button></div>}

          <section className="stats" aria-label="Resumo da conta">
            <article><div className="stat-icon green">◎</div><div><small>MEUS BECOINS</small><strong>2.450 <em>BC</em></strong><p>Equivale a <b>R$ 24,50</b></p></div><button onClick={() => choose("BeCoins")}>→</button></article>
            <article><div className="stat-icon purple">▣</div><div><small>PRÓXIMA ENTREGA</small><strong>12 Ago</strong><p>Kit Essencial · Assinatura</p></div><button onClick={() => choose("Meus pedidos")}>→</button></article>
            <article><div className="stat-icon coral">♥</div><div><small>MINHA JORNADA</small><strong>7 dias</strong><p>Você está construindo constância</p></div><button onClick={() => choose("Minha jornada")}>→</button></article>
          </section>

          <section className="main-grid">
            <div className="products-panel">
              <div className="section-title"><div><small>SUA ROTINA BEYOU</small><h3>Seus produtos de hoje</h3></div><button onClick={() => choose("Loja")}>Ver todos <span>→</span></button></div>
              <div className="product-list">
                {products.map((product, index) => (
                  <article className="product" key={product.name}>
                    <div className={`pack ${product.tone}`}><span>BEYOU</span><strong>{product.name}</strong><i>{index === 1 ? "●" : "✦"}</i></div>
                    <div className="product-copy"><span className="pill">{product.label}</span><h4>{product.name}</h4><p>{product.detail}</p><small>{index === 2 ? "À noite, antes de dormir" : index === 1 ? "1 medida pela manhã" : "2 cápsulas pela manhã"}</small></div>
                    <button className="check" aria-label={`Marcar ${product.name} como usado`} onClick={(event) => event.currentTarget.classList.toggle("done")}>✓</button>
                  </article>
                ))}
              </div>
            </div>

            <aside className="journey-card">
              <div className="journey-top"><span>✦</span><small>SUA MELHOR VERSÃO</small><h3>Uma escolha por dia.<br />Uma mudança para sempre.</h3><p>Complete sua rotina e acompanhe sua evolução.</p></div>
              <div className="progress-copy"><span>Progresso de hoje</span><b>2 de 3</b></div>
              <div className="progress"><i /></div>
              <div className="days">{["S", "T", "Q", "Q", "S", "S", "D"].map((day, i) => <div key={`${day}-${i}`}><span className={i < 5 ? "complete" : i === 5 ? "today" : ""}>{i < 5 ? "✓" : day}</span><small>{i === 5 ? "Hoje" : day}</small></div>)}</div>
              <button onClick={() => choose("Minha jornada")}>Continuar minha jornada <span>→</span></button>
            </aside>
          </section>
        </div>
      </section>

      <nav className="bottom-nav" aria-label="Navegação mobile">
        {navItems.slice(0, 5).map(([label, icon]) => <button key={label} onClick={() => choose(label)} className={active === label ? "active" : ""}><b>{icon}</b><span>{label === "Visão geral" ? "Início" : label.replace("Meus ", "")}</span></button>)}
      </nav>
    </main>
  );
}
