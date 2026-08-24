import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createProductService } from "../../modules/products/infrastructure/product-factory";
import type { Product } from "../../modules/products/domain/product";
import { OpenCartButton } from "../../modules/checkout/presentation/cart-store";
import { dashboardDestination } from "../../lib/auth/dashboard-destination";
import { StoreCatalog } from "./store-catalog";
import Image from "next/image";
// StoreCatalog renders the shared AddToCartButton for every filtered product.

export default async function StorePage() {
  const supabase = await createServerSupabaseClient();
  const{data:{user}}=await supabase.auth.getUser();
  const{data:viewerProfile}=user?await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle():{data:null};
  let products: readonly Product[]=[];
  let failed=false;
  try { products=await createProductService(supabase).listCatalog(); } catch { failed=true; }
  return <main className="store-page"><div className="store-promo" aria-label="Benefícios da loja"><span>✨ Frete grátis acima de R$ 600</span><span>💜 Clube BeYou em todo pedido</span><span>⚡ Pix com 3% de desconto</span><span>🎁 Acumule BeCoins</span></div><header className="store-header"><Link className="store-brand" href="/"><b>BeYou Nutrition</b><small>Você na sua melhor versão</small></Link><nav className="store-main-nav" aria-label="Loja BEYOU"><Link href="/">Início</Link><a href="#produtos">Loja</a><Link href="/quem-somos">Nossa marca</Link></nav><nav className="store-actions"><OpenCartButton/><Link className="store-account" href={user?dashboardDestination(viewerProfile?.role):"/login"}>{user?"Minha área":"Entrar"}</Link></nav></header>
    <section className="store-hero"><div className="store-hero-copy"><span className="store-eyebrow">● Loja oficial BeYou</span><h1>Sua rotina BeYou começa pelo que você precisa hoje.</h1><p>Escolha cápsulas, fibras, gotas ou a experiência completa para uma rotina mais leve, prática e constante.</p><div className="store-hero-actions"><a href="#produtos">Descobrir minha rotina</a><Link href="/quem-somos">Conhecer a BeYou</Link></div><div className="store-trust"><span>✓ Compra segura</span><span>✓ Acompanhamento conectado</span><span>✓ Benefícios BeYou</span></div></div><aside className="store-feature"><div><small>EXPERIÊNCIA COMPLETA</small><h2>BeYou Box</h2><p>BeFit, BeFiber e BeCalm em uma rotina pensada para acompanhar seu dia.</p></div><Image src="https://beyou-teste-nine.vercel.app/beyou-box-hero.webp" alt="BeYou Box" width={992} height={794}/><a href="#produtos">Ver experiência completa →</a></aside></section>
    <section className="catalog" id="produtos" aria-labelledby="catalog-title"><div className="catalog-title"><div><small>LOJA BEYOU</small><h2 id="catalog-title">Nossa seleção</h2></div></div>
      {failed && <p className="catalog-message" role="alert">Não foi possível carregar os produtos agora.</p>}
      {!failed && products.length === 0 && <p className="catalog-message">Novidades chegando em breve.</p>}
      {!failed&&products.length>0&&<StoreCatalog products={products}/>} 
    </section></main>;
}
