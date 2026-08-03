import Link from "next/link";
import Image from "next/image";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createProductService } from "../../modules/products/infrastructure/product-factory";
import type { Product } from "../../modules/products/domain/product";
import { AddToCartButton, OpenCartButton } from "../../modules/checkout/presentation/cart-store";
const money = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" });

export default async function StorePage() {
  const supabase = await createServerSupabaseClient();
  let products: readonly Product[]=[];
  let failed=false;
  try { products=await createProductService(supabase).listCatalog(); } catch { failed=true; }
  return <main className="store-page"><header className="store-header"><Link className="store-brand" href="/"><b>BE</b>YOU <small>Nutrition</small></Link><nav className="store-actions"><OpenCartButton/><Link className="store-account" href="/minha-area">Minha área</Link></nav></header>
    <section className="store-hero"><p>CIÊNCIA, TECNOLOGIA E CUIDADO</p><h1>Produtos para sua melhor versão.</h1><span>Uma rotina completa pensada para acompanhar você todos os dias.</span></section>
    <section className="catalog" aria-labelledby="catalog-title"><div className="catalog-title"><div><small>LOJA BEYOU</small><h2 id="catalog-title">Nossa seleção</h2></div><span>{products.length} {products.length === 1 ? "produto" : "produtos"}</span></div>
      {failed && <p className="catalog-message" role="alert">Não foi possível carregar os produtos agora.</p>}
      {!failed && products.length === 0 && <p className="catalog-message">Novidades chegando em breve.</p>}
      <div className="catalog-grid">{products.map((product) => <article className="catalog-card" key={product.id}><Link className="catalog-card-link" href={`/loja/${product.slug}`} aria-label={`Ver ${product.name}`}><div className="catalog-pack"><Image src={product.imageUrl??"https://beyou-teste-nine.vercel.app/beyou-box-hero.webp"} alt={product.name} width={992} height={794} sizes="(max-width: 700px) 88vw, 40vw" /></div>{product.featured && <small className="featured-badge">DESTAQUE</small>}<h3>{product.name}</h3><p>{product.shortDescription}</p><strong>{product.priceCents===null?"Em breve":money.format(product.priceCents/100)}</strong></Link><div className="catalog-card-actions"><Link href={`/loja/${product.slug}`}>Ver detalhes</Link><AddToCartButton productId={product.id} disabled={product.stockQuantity < 1 || product.priceCents === null}>+ Carrinho</AddToCartButton></div></article>)}</div>
    </section></main>;
}
