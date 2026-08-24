import Image from "next/image";
import Link from "next/link";
import { createServerSupabaseClient } from "../lib/supabase/server";
import { createProductService } from "../modules/products/infrastructure/product-factory";
import { AuthRecoveryBridge } from "./auth/recovery-bridge";
import { dashboardDestination } from "../lib/auth/dashboard-destination";
import { BrandLogo } from "../components/brand-logo";
import styles from "./commercial.module.css";
import audit from "./commercial-audit.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const routine = [
  { moment:"MANHÃ", name: "BeFit", description:"Energia limpa e metabolismo acelerado, sem crash.", detail: "60 cápsulas · 30 dias", href:"/loja/befit", image: "https://beyou-teste-nine.vercel.app/beyou-produto-befit.webp", theme: "lime" },
  { moment:"DURANTE O DIA", name: "BeFiber", description:"Fibras que regulam o intestino e dão mais saciedade.", detail: "210 g · 30 doses", href:"/loja/befiber", image: "https://beyou-teste-nine.vercel.app/beyou-produto-befiber.webp", theme: "violet" },
  { moment:"NOITE", name: "BeCalm", description:"Noites melhores e sono profundo, em gotas.", detail: "30 ml · Maracujá roxo", href:"/loja/becalm", image: "https://beyou-teste-nine.vercel.app/beyou-produto-becalm.webp", theme: "purple" },
] as const;

const faqs=[
  ["Como usar cada produto?","Cada produto tem seu momento: BeFit pela manhã, BeFiber ao longo do dia e BeCalm à noite. As instruções de uso e dose estão no rótulo de cada embalagem."],
  ["Preciso usar os três juntos?","Não. Eles podem ser adquiridos separadamente, mas a Box organiza os três momentos em uma rotina única."],
  ["O que vem na BeYou Box?","Uma unidade de BeFit, BeFiber e BeCalm reunidas em uma única experiência."],
  ["Como funciona a entrega?","Enviamos para todo o Brasil e você acompanha o pedido pela sua conta."],
] as const;

export default async function CommercialHomePage() {
  const supabase = await createServerSupabaseClient();
  const{data:{user}}=await supabase.auth.getUser();
  const{data:viewerProfile}=user?await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle():{data:null};
  const panelHref=dashboardDestination(viewerProfile?.role);
  const product = await createProductService(supabase).getPublished("kit-essencial-beyou");
  const price = product?.priceCents !== null && product ? money.format(product.priceCents / 100) : "Consulte na loja";
  const installment = product?.priceCents !== null && product ? money.format(product.priceCents / 300) : null;

  return (
    <main className={`${styles.page} ${audit.scroll} beyou-branded-home`}>
      <AuthRecoveryBridge />
      <div className={styles.benefits} aria-label="Benefícios da loja">
        <Link className={audit.benefitLink} href="/loja">▣ Envio para todo o Brasil</Link><Link className={audit.benefitLink} href="/loja">ϟ Frete grátis acima de R$ 600</Link><Link className={audit.benefitLink} href="#garantias">♙ Compra segura</Link>
      </div>

      <header className={styles.header}>
        <Link href="/" aria-label="BeYou — voltar ao início"><BrandLogo className={styles.logo} tone="light"/></Link>
        <nav aria-label="Navegação principal">
          <Link href="#produtos">Produtos</Link><Link href="/minha-area">Clube</Link><Link href="#proposito">Quem somos</Link><Link href="#duvidas">Dúvidas</Link>
        </nav>
        <div className={styles.actions}><Link className={styles.buyButton} href={product ? `/loja/${product.slug}?cart=open` : "/loja"}>Comprar a BeYou Box →</Link>{user?<Link className={styles.areaButton} href={panelHref}>Acessar painel →</Link>:<Link className={styles.areaButton} href="/login">Entrar →</Link>}</div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p>BEYOU BOX · ROTINA COMPLETA EM 3 ETAPAS</p>
          <h1>Três momentos.<br />Uma rotina.<br /><em>Sua melhor versão.</em></h1>
          <span>{product?.shortDescription ?? "BeFit, BeFiber e BeCalm juntos em uma rotina simples para acompanhar o seu dia."}</span>
          <div className={styles.price}><small>BEYOU BOX</small><strong>{price}</strong>{installment && <span>ou 3x de {installment} sem juros</span>}</div>
          <div className={styles.heroActions}><Link href={product ? `/loja/${product.slug}?cart=open` : "/loja"}>Quero minha BeYou Box <span>→</span></Link><Link href="#produtos">Entender a rotina</Link></div>
          <p className={styles.safety}>Frete grátis nesta compra · Compra segura · 7 dias para desistir</p>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.glow} />
          <Image src="https://beyou-teste-nine.vercel.app/beyou-box-hero.webp" alt="BeYou Box com BeFit, BeFiber e BeCalm" width={992} height={794} priority sizes="(max-width: 800px) 92vw, 48vw" />
          <span className={styles.floatLabel}>LANÇAMENTO · ROTINA COMPLETA</span>
        </div>
      </section>

      <section className={styles.trust} aria-label="Compromissos BEYOU">
        <article><b>▢</b><strong>Pagamento seguro</strong></article><article><b>▣</b><strong>Envio para todo o Brasil</strong></article><article><b>♧</b><strong>Com ativos naturais</strong></article><article><b>◇</b><strong>7 dias para desistir</strong></article>
      </section>

      <section className={styles.products} id="produtos">
        <div className={styles.sectionHeading}><div><small>UMA ROTINA QUE ACOMPANHA O SEU DIA</small><h2>Três produtos.<br/>Três momentos.</h2></div><Link href="/loja">Ver loja completa →</Link></div>
        <div className={styles.productGrid}>
          {routine.map((item) => <Link href={item.href} className={`${styles.productCard} ${styles[item.theme]} ${audit.clickableCard}`} key={item.name}>
            <div className={styles.productImage}><small>{item.moment}</small><Image src={item.image} alt={`Embalagem ${item.name}`} width={466} height={760} sizes="(max-width: 700px) 70vw, 26vw" /></div>
            <div className={styles.productCopy}><h3>{item.name}</h3><p>{item.description}</p><span>{item.detail}</span><b>Conhecer o {item.name} →</b></div>
          </Link>)}
        </div>
      </section>

      <section className={styles.reasons} id="proposito"><small>POR QUE OS TRÊS JUNTOS</small><h2>Diferentes momentos.<br/>Uma rotina mais simples.</h2><div><article><b>✓</b><h3>Rotina organizada</h3><p>Um produto para cada momento — sem esquecer, sem misturar.</p></article><article><b>✓</b><h3>Reunidos em um kit</h3><p>Os três chegam em uma única embalagem, prontos para começar.</p></article><article><b>✓</b><h3>Economia real</h3><p>Você paga menos do que levaria os três produtos separados.</p></article></div></section>
      <section className={styles.guarantees} id="garantias"><small>O QUE GARANTE A BEYOU</small><h2>Compromissos com quem toma</h2><div><article><b>♧</b><h3>Com ativos naturais</h3><p>Fórmulas construídas em torno de ingredientes selecionados.</p></article><article><b>◇</b><h3>Transparência total</h3><p>Cada ingrediente com nome e quantidade, de forma clara.</p></article><article><b>▣</b><h3>Da compra à sua porta</h3><p>Envio para todo o Brasil e acompanhamento do pedido.</p></article></div></section>
      <section className={styles.faq} id="duvidas"><small>DÚVIDAS RÁPIDAS</small><h2>Tudo o que você <em>precisa saber</em></h2><div>{faqs.map(([question,answer],i)=><details key={question} open={i===0}><summary>{question}<b>⌄</b></summary><p>{answer}</p></details>)}</div></section>
      <section className={styles.purpose}><h2>Sua rotina pode<br/>começar hoje.</h2><p>Três momentos, uma rotina, uma única BeYou Box.</p><div><Link href={product ? `/loja/${product.slug}?cart=open` : "/loja"}>Quero minha BeYou Box →</Link><Link href="/loja">Ver todos os produtos</Link></div></section>

      <footer className={styles.footer}><div><BrandLogo className={styles.logo} tone="light"/><p>Suplementos com ativos naturais para energia, saciedade e sono.<br/>Cuidar de você é a nossa fórmula.</p></div><div><strong>Loja</strong><Link href="/loja">Produtos</Link><Link href="#duvidas">Dúvidas</Link></div><div><strong>Clube</strong><Link href="/cadastro">Criar conta grátis</Link><Link href="/login">Entrar</Link></div><div><strong>Marca</strong><Link href="#proposito">Quem somos</Link><Link href="/suporte">SAC / Atendimento</Link></div><small>© 2026 BeYou · Todos os direitos reservados.</small></footer>
    </main>
  );
}
