import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

type Props = { params: Promise<{ slug:string }> };
const money = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" });

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("products").select("slug, name, short_description, description, price_cents, compare_at_price_cents, stock_quantity").eq("slug", slug).eq("status", "ACTIVE").maybeSingle();
  if (!data) notFound();
  const available = data.stock_quantity > 0;
  return <main className="product-page"><header className="store-header"><Link className="store-brand" href="/loja"><b>BE</b>YOU <small>Nutrition</small></Link><Link className="store-account" href="/loja">← Voltar à loja</Link></header><section className="product-detail"><div className="product-visual"><span>BEYOU</span><b>{data.name}</b><i>✦</i></div><div className="product-info"><small>PRODUTO BEYOU</small><h1>{data.name}</h1><p>{data.description ?? data.short_description}</p><strong>{money.format(data.price_cents / 100)}</strong><button disabled={!available}>{available ? "Adicionar ao carrinho" : "Em breve"}</button>{!available && <span>Este produto ainda não possui estoque disponível.</span>}</div></section></main>;
}
