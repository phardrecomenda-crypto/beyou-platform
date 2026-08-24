import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createProductService } from "../../modules/products/infrastructure/product-factory";
import type { Product } from "../../modules/products/domain/product";
import { OpenCartButton } from "../../modules/checkout/presentation/cart-store";
import { dashboardDestination } from "../../lib/auth/dashboard-destination";
import { StoreCatalog } from "./store-catalog";
// StoreCatalog renders the shared AddToCartButton for every filtered product.

export default async function StorePage() {
  const supabase = await createServerSupabaseClient();
  const{data:{user}}=await supabase.auth.getUser();
  const{data:viewerProfile}=user?await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle():{data:null};
  let products: readonly Product[]=[];
  let failed=false;
  try { products=await createProductService(supabase).listCatalog(); } catch { failed=true; }
  return <main className="store-page"><header className="store-header"><Link className="store-brand" href="/"><b>BE</b>YOU <small>Nutrition</small></Link><nav className="store-main-nav" aria-label="Loja BEYOU"><Link href="/">Início</Link><a href="#produtos">Produtos</a><Link href="/quem-somos">Quem somos</Link></nav><nav className="store-actions"><OpenCartButton/><Link className="store-account" href={user?dashboardDestination(viewerProfile?.role):"/login"}>{user?"Acessar painel":"Entrar"}</Link></nav></header>
    <section className="store-hero"><p>CIÊNCIA, TECNOLOGIA E CUIDADO</p><h1>Produtos para sua melhor versão.</h1><span>Uma rotina completa pensada para acompanhar você todos os dias.</span></section>
    <section className="catalog" id="produtos" aria-labelledby="catalog-title"><div className="catalog-title"><div><small>LOJA BEYOU</small><h2 id="catalog-title">Nossa seleção</h2></div></div>
      {failed && <p className="catalog-message" role="alert">Não foi possível carregar os produtos agora.</p>}
      {!failed && products.length === 0 && <p className="catalog-message">Novidades chegando em breve.</p>}
      {!failed&&products.length>0&&<StoreCatalog products={products}/>} 
    </section></main>;
}
