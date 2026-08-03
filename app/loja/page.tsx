import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabase/server";

type Product = { id:string; slug:string; name:string; short_description:string; price_cents:number; stock_quantity:number; featured:boolean };
const money = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" });

export default async function StorePage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("products")
    .select("id, slug, name, short_description, price_cents, stock_quantity, featured")
    .eq("status", "ACTIVE").order("featured", { ascending:false }).order("created_at", { ascending:false });
  const products = (data ?? []) as Product[];
  return <main className="store-page"><header className="store-header"><Link className="store-brand" href="/"><b>BE</b>YOU <small>Nutrition</small></Link><Link className="store-account" href="/minha-area">Minha área</Link></header>
    <section className="store-hero"><p>CIÊNCIA, TECNOLOGIA E CUIDADO</p><h1>Produtos para sua melhor versão.</h1><span>Uma rotina completa pensada para acompanhar você todos os dias.</span></section>
    <section className="catalog" aria-labelledby="catalog-title"><div className="catalog-title"><div><small>LOJA BEYOU</small><h2 id="catalog-title">Nossa seleção</h2></div><span>{products.length} {products.length === 1 ? "produto" : "produtos"}</span></div>
      {error && <p className="catalog-message" role="alert">Não foi possível carregar os produtos agora.</p>}
      {!error && products.length === 0 && <p className="catalog-message">Novidades chegando em breve.</p>}
      <div className="catalog-grid">{products.map((product) => <article className="catalog-card" key={product.id}><div className="catalog-pack"><span>BEYOU</span><b>{product.name}</b><i>✦</i></div>{product.featured && <small className="featured-badge">DESTAQUE</small>}<h3>{product.name}</h3><p>{product.short_description}</p><strong>{money.format(product.price_cents / 100)}</strong><Link href={`/loja/${product.slug}`}>{product.stock_quantity > 0 ? "Ver produto" : "Conhecer produto"} <span>→</span></Link></article>)}</div>
    </section></main>;
}
