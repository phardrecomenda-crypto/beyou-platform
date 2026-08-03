import Image from "next/image";
import Link from "next/link";
import { createServerSupabaseClient } from "../lib/supabase/server";
import { createProductService } from "../modules/products/infrastructure/product-factory";
import styles from "./commercial.module.css";
import audit from "./commercial-audit.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const routine = [
  { name: "BeFit", detail: "60 cápsulas · manhã", href:"/loja/befit", image: "https://beyou-teste-nine.vercel.app/beyou-produto-befit.webp", theme: "lime" },
  { name: "BeFiber", detail: "210 g · durante o dia", href:"/loja/befiber-morango", image: "https://beyou-teste-nine.vercel.app/beyou-produto-befiber.webp", theme: "violet" },
  { name: "BeCalm", detail: "30 ml · noite", href:"/loja/becalm", image: "https://beyou-teste-nine.vercel.app/beyou-produto-becalm.webp", theme: "cream" },
] as const;

export default async function CommercialHomePage() {
  const supabase = await createServerSupabaseClient();
  const product = await createProductService(supabase).getPublished("kit-essencial-beyou");
  const price = product?.priceCents !== null && product ? money.format(product.priceCents / 100) : "Consulte na loja";
  const installment = product?.priceCents !== null && product ? money.format(product.priceCents / 300) : null;

  return (
    <main className={`${styles.page} ${audit.scroll}`}>
      <div className={styles.benefits} aria-label="Benefícios da loja">
        <Link className={audit.benefitLink} href="/loja">Envio para todo o Brasil</Link><Link className={audit.benefitLink} href="/loja">Frete grátis acima de R$ 600</Link><Link className={audit.benefitLink} href="#proposito">Compra segura</Link><Link className={audit.benefitLink} href="/cadastro">Acumule BeCoins</Link>
      </div>

      <header className={styles.header}>
        <Link className={styles.logo} href="/" aria-label="BEYOU — início"><b>BE</b>YOU<small>Nutrition</small></Link>
        <nav aria-label="Navegação principal">
          <Link href="/">Início</Link><Link href="/loja">Loja</Link><Link href="#produtos">Produtos</Link><Link href="#proposito">Quem somos</Link>
        </nav>
        <div className={styles.actions}><Link href="/login">Entrar</Link><Link className={styles.areaButton} href="/minha-area">Minha área</Link></div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p>BEYOU BOX · ROTINA COMPLETA EM 3 ETAPAS</p>
          <h1>Três momentos.<br />Uma rotina.<br /><em>Sua melhor versão.</em></h1>
          <span>{product?.shortDescription ?? "BeFit, BeFiber e BeCalm juntos em uma rotina simples para acompanhar o seu dia."}</span>
          <div className={styles.price}><small>BEYOU BOX</small><strong>{price}</strong>{installment && <span>ou 3x de {installment} sem juros</span>}</div>
          <div className={styles.heroActions}><Link href={product ? `/loja/${product.slug}?cart=open` : "/loja"}>Comprar a BeYou Box <span>→</span></Link><small>Máximo de 1 unidade por pedido</small></div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.glow} />
          <Image src="https://beyou-teste-nine.vercel.app/beyou-box-hero.webp" alt="BeYou Box com BeFit, BeFiber e BeCalm" width={992} height={794} priority sizes="(max-width: 800px) 92vw, 48vw" />
          <span className={styles.floatLabel}>BeFit · BeFiber · BeCalm</span>
        </div>
      </section>

      <section className={styles.trust} aria-label="Compromissos BEYOU">
        <article><b>01</b><div><strong>Rotina simples</strong><span>Produtos pensados para acompanhar diferentes momentos do seu dia.</span></div></article>
        <article><b>02</b><div><strong>Experiência integrada</strong><span>Loja, acompanhamento e benefícios em uma única plataforma.</span></div></article>
        <article><b>03</b><div><strong>Cuidado contínuo</strong><span>Tecnologia e relacionamento para apoiar escolhas mais conscientes.</span></div></article>
      </section>

      <section className={styles.products} id="produtos">
        <div className={styles.sectionHeading}><div><small>ROTINA BEYOU</small><h2>Um produto para cada momento.</h2></div><Link href="/loja">Ver loja completa →</Link></div>
        <div className={styles.productGrid}>
          {routine.map((item, index) => <Link href={item.href} className={`${styles.productCard} ${styles[item.theme]} ${audit.clickableCard}`} key={item.name}>
            <div><small>ETAPA {index + 1}</small><h3>{item.name}</h3><p>{item.detail}</p></div>
            <Image src={item.image} alt={`Embalagem ${item.name}`} width={466} height={760} sizes="(max-width: 700px) 70vw, 26vw" />
          </Link>)}
        </div>
      </section>

      <section className={styles.purpose} id="proposito"><small>SEJA VOCÊ NA SUA MELHOR VERSÃO</small><h2>Ciência, tecnologia, acompanhamento e comunidade em um só ecossistema.</h2><p>A BEYOU existe para tornar a jornada de saúde e bem-estar mais simples, conectada e sustentável.</p><Link href="/cadastro">Criar minha conta →</Link></section>

      <footer className={styles.footer}><div className={styles.logo}><b>BE</b>YOU<small>Nutrition</small></div><p>© 2026 BEYOU. Todos os direitos reservados.</p><div><Link href="/loja">Loja</Link><Link href="/login">Minha conta</Link></div></footer>
    </main>
  );
}
