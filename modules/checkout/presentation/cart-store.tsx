"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { Product } from "../../products/domain/product";
import type { Cart } from "../domain/cart";

type CartApiResult = { cart?: Cart; code?: "AUTHENTICATION_REQUIRED" | "PRODUCT_UNAVAILABLE" | "CART_ERROR" };

async function updateCart(productId: string, method: "POST" | "DELETE") {
  const response = await fetch("/api/cart/items", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  const result = await response.json().catch(() => ({})) as CartApiResult;
  if (!response.ok || !result.cart) throw new Error(result.code ?? "CART_ERROR");
  return result.cart;
}

type CartContextValue = Readonly<{
  cart: Cart | null;
  busy: boolean;
  open: () => void;
  add: (productId: string) => void;
  remove: (productId: string) => void;
}>;

const CartContext = createContext<CartContextValue | null>(null);
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CartStore({ children, initialCart, products }: Readonly<{ children: ReactNode; initialCart: Cart | null; products: readonly Product[] }>) {
  const [cart, setCart] = useState(initialCart);
  const [syncedInitialCart, setSyncedInitialCart] = useState(initialCart);
  const [opened, setOpened] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const closeButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Reset local cart state when the server-provided cart changes, computed
  // during render (per https://react.dev/learn/you-might-not-need-an-effect)
  // instead of syncing via a setState-in-effect, which the React Compiler
  // flags as a cascading-render risk.
  if (initialCart !== syncedInitialCart) {
    setSyncedInitialCart(initialCart);
    setCart(initialCart);
  }

  useEffect(() => {
    // Reads window.location on mount only; must stay an effect since the URL
    // is a browser-only API and this keeps SSR/hydration output stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(window.location.search).get("cart") === "open") setOpened(true);
  }, []);

  useEffect(() => {
    if (!opened) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpened(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [opened]);

  const run = (productId: string, method: "POST" | "DELETE") => startTransition(async () => {
    setMessage(null);
    try {
      const updated = await updateCart(productId, method);
      setCart(updated);
      setOpened(true);
      router.refresh();
      return;
    } catch (error) {
      const code = error instanceof Error ? error.message : "CART_ERROR";
      if (code === "AUTHENTICATION_REQUIRED") {
        router.push(`/login?next=${encodeURIComponent(`${pathname}?cart=open`)}`);
        return;
      }
      setOpened(true);
      setMessage(code === "PRODUCT_UNAVAILABLE"
        ? "Este produto não está disponível."
        : "Não foi possível atualizar o carrinho agora.");
    }
  });

  const value = useMemo<CartContextValue>(() => ({
    cart,
    busy,
    open: () => setOpened(true),
    add: (productId) => run(productId, "POST"),
    remove: (productId) => run(productId, "DELETE"),
  // run only closes over the current route and router.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cart, busy, pathname, router]);

  const subtotal = cart?.summary.subtotalCents ?? 0;
  const progress = Math.min(100, Math.round((subtotal / 60_000) * 100));
  const present = new Set(cart?.items.map((item) => item.productId) ?? []);
  const bumps = products.filter((product) =>
    product.priceCents !== null && product.stockQuantity > 0 && !present.has(product.id));

  return <CartContext.Provider value={value}>
    {children}
    <button className="floating-cart" type="button" onClick={() => setOpened(true)} aria-label={`Abrir carrinho com ${cart?.summary.itemCount ?? 0} itens`}>
      <span aria-hidden="true">🛍</span><b>{cart?.summary.itemCount ?? 0}</b>
    </button>
    {opened && <div className="cart-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpened(false)}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-busy={busy}>
        <header><div><small>SEU PEDIDO</small><h2 id="cart-title">Carrinho</h2></div><button ref={closeButton} type="button" onClick={() => setOpened(false)} aria-label="Fechar carrinho">×</button></header>
        <section className="shipping-progress" aria-label={`${progress}% da meta de frete grátis`}>
          <p>{cart?.summary.qualifiesForFreeShipping ? "Frete grátis conquistado!" : <>Faltam <strong>{money.format((cart?.summary.freeShippingRemainingCents ?? 60_000) / 100)}</strong> para frete grátis</>}</p>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div><small>Meta: R$ 600,00</small>
        </section>
        <div className="cart-items">
          {!cart?.items.length && <div className="empty-cart"><span aria-hidden="true">🛍</span><h3>Seu carrinho está vazio</h3><p>Escolha os produtos que combinam com sua rotina.</p></div>}
          {cart?.items.map((item) => <article className="cart-item" key={item.id}><div><strong>{item.productName}</strong><small>1 unidade</small></div><div><b>{money.format(item.lineTotalCents / 100)}</b><button disabled={busy} type="button" onClick={() => value.remove(item.productId)}>Remover</button></div></article>)}
        </div>
        {bumps.length > 0 && <section className="order-bumps"><small>COMPLETE SUA ROTINA</small><h3>Ganhe frete grátis mais rápido</h3>{bumps.map((product) => <article key={product.id}><div><strong>{product.name}</strong><span>{money.format((product.priceCents ?? 0) / 100)}</span></div><button disabled={busy} type="button" onClick={() => value.add(product.id)}>+ Adicionar</button></article>)}</section>}
        {message && <p className="cart-error" role="alert">{message}</p>}
        <footer><div><span>Subtotal</span><strong>{money.format(subtotal / 100)}</strong></div><Link className={cart?.items.length ? "" : "disabled"} aria-disabled={!cart?.items.length} tabIndex={cart?.items.length ? 0 : -1} href={cart?.items.length ? "/checkout" : "/loja"}>Ir para o checkout</Link><small>Pagamento seguro • 3% de desconto no Pix</small></footer>
      </aside>
    </div>}
  </CartContext.Provider>;
}

export function AddToCartButton({ productId, disabled = false, children = "Adicionar ao carrinho" }: Readonly<{ productId: string; disabled?: boolean; children?: ReactNode }>) {
  const store = useContext(CartContext);
  if (!store) throw new Error("CartStore is required");
  const included = store.cart?.items.some((item) => item.productId === productId) ?? false;
  return <button className="add-cart-button" type="button" disabled={disabled || included || store.busy} onClick={() => store.add(productId)}>{included ? "Já está no carrinho" : children}</button>;
}

export function OpenCartButton() {
  const store = useContext(CartContext);
  if (!store) throw new Error("CartStore is required");
  return <button className="header-cart-button" type="button" onClick={store.open}>Carrinho <b>{store.cart?.summary.itemCount ?? 0}</b></button>;
}
