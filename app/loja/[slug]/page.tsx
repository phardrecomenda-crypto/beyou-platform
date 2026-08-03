import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { createProductService } from "../../../modules/products/infrastructure/product-factory";
import { productHighlights } from "../../../modules/products/domain/product";
import { AddToCartButton, OpenCartButton } from "../../../modules/checkout/presentation/cart-store";

type Props = { params: Promise<{ slug:string }> };
const money = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" });

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const data = await createProductService(supabase).getPublished(slug);
  if (!data) notFound();
  const available = data.stockQuantity > 0;
  const highlights = productHighlights(data);
  return <main className="product-page"><header className="store-header"><Link className="store-brand" href="/"><b>BE</b>YOU <small>Nutrition</small></Link><nav className="store-actions"><OpenCartButton/><Link className="store-account" href="/loja">← Voltar à loja</Link></nav></header><section className="product-detail"><div className="product-visual"><div className="product-glow" /><Image src={data.imageUrl??"https://beyou-teste-nine.vercel.app/beyou-box-hero.webp"} alt={data.name} width={992} height={794} priority sizes="(max-width: 720px) 90vw, 45vw" /></div><div className="product-info"><small>ROTINA BEYOU</small><h1>{data.name}</h1><p>{data.description ?? data.shortDescription}</p>{highlights.length>0&&<dl className="product-highlights">{highlights.map((highlight)=><div key={highlight.label}><dt>{highlight.label}</dt><dd>{highlight.value}</dd></div>)}</dl>}<strong>{data.priceCents===null?"Em breve":money.format(data.priceCents/100)}</strong><AddToCartButton productId={data.id} disabled={!available || data.priceCents === null}>{available ? "Adicionar ao carrinho" : "Em breve"}</AddToCartButton>{!available && <span>Este produto ainda não possui estoque disponível.</span>}<div className="product-benefits"><span>✓ Compra segura</span><span>✓ Acumule BeCoins</span><span>✓ Envio para todo o Brasil</span></div></div></section></main>;
}
