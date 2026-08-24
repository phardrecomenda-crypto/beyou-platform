import Link from "next/link";
import { BrandLogo } from "./brand-logo";

export function PublicSiteShell({children}:{children:React.ReactNode}){
  return <main className="public-site-shell">
    <div className="public-benefits"><span>Envio para todo o Brasil</span><span>Frete grátis acima de R$ 600</span><span>Compra segura</span></div>
    <header className="public-header"><Link href="/"><BrandLogo tone="light"/></Link><nav><Link href="/loja">Produtos</Link><Link href="/clube">Clube</Link><Link href="/quem-somos">Quem somos</Link><Link href="/sac">Dúvidas</Link></nav><div><Link className="public-buy" href="/produto/beyou-box?openCart=1">Comprar a BeYou Box</Link><Link className="public-enter" href="/entrar">Entrar →</Link></div></header>
    {children}
    <footer className="public-footer"><div><BrandLogo tone="light"/><p>Suplementos com ativos naturais para energia, saciedade e sono. Cuidar de você é a nossa fórmula.</p></div><div><strong>Loja</strong><Link href="/loja">Produtos</Link><Link href="/#duvidas">Dúvidas</Link><Link href="/checkout">Carrinho</Link></div><div><strong>Clube</strong><Link href="/cadastro">Criar conta grátis</Link><Link href="/entrar">Entrar</Link><Link href="/clube">Minha Área</Link></div><div><strong>Marca</strong><Link href="/quem-somos">Quem somos</Link><Link href="/sac">SAC / Atendimento</Link><Link href="/parceiros">Seja parceiro</Link></div></footer>
  </main>
}
