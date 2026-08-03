"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { Cart } from "../../modules/checkout/domain/cart";
import type { CheckoutCustomer, CustomerAddress } from "../../modules/checkout/domain/checkout";
import { createCustomerAddress, startCheckout } from "./actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const field = (form: FormData, name: string) => String(form.get(name) ?? "");

export function CheckoutForm({ cart, customer, addresses }: Readonly<{
  cart: Cart;
  customer: CheckoutCustomer | null;
  addresses: readonly CustomerAddress[];
}>) {
  const [selectedAddress, setSelectedAddress] = useState(addresses[0]?.id ?? "new");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [installments, setInstallments] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [busy, startTransition] = useTransition();
  const maxInstallments = cart.summary.subtotalCents <= 49_999 ? 3 : cart.summary.subtotalCents <= 99_999 ? 6 : 10;
  const pixDiscount = Math.round(cart.summary.subtotalCents * 0.03);
  const estimatedTotal = cart.summary.qualifiesForFreeShipping
    ? cart.summary.subtotalCents - (paymentMethod === "PIX" ? pixDiscount : 0)
    : null;
  const installmentOptions = useMemo(() => Array.from({ length: maxInstallments }, (_, index) => index + 1), [maxInstallments]);

  function submit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      let addressId = selectedAddress;
      if (selectedAddress === "new") {
        const result = await createCustomerAddress({
          label: field(formData, "label"), recipientName: field(formData, "recipientName"),
          phone: field(formData, "phone"), postalCode: field(formData, "postalCode"),
          street: field(formData, "street"), number: field(formData, "number"),
          complement: field(formData, "complement") || null,
          neighborhood: field(formData, "neighborhood"), city: field(formData, "city"),
          state: field(formData, "state"), isDefault: formData.get("isDefault") === "on",
        });
        if (!result.ok) {
          setError(result.code === "ADDRESS_INVALID" ? "Revise os dados do endereço." : "Não foi possível salvar o endereço.");
          return;
        }
        addressId = result.address.id;
        setSelectedAddress(addressId);
      }
      const result = await startCheckout({ addressId, paymentMethod, installments: paymentMethod === "PIX" ? 1 : installments });
      if (!result.ok) {
        setError(result.code === "INSTALLMENTS_INVALID" ? "O parcelamento escolhido não está disponível." : "Não foi possível preparar o checkout.");
        return;
      }
      setCompleted(true);
    });
  }

  return <main className="checkout-page">
    <header className="checkout-header"><Link href="/loja" aria-label="Voltar para a loja">BEYOU</Link><div><span className="active">1</span><b>Dados</b><i /><span>2</span><b>Pagamento</b><i /><span>3</span><b>Confirmação</b></div><small>Ambiente seguro</small></header>
    <div className="checkout-shell">
      <form action={submit} className="checkout-content">
        <section className="checkout-hero"><small>FINALIZE SUA COMPRA</small><h1>Seu protocolo começa aqui.</h1><p>Revise seus dados e escolha como deseja pagar.</p></section>

        <section className="checkout-card"><div className="section-title"><span>1</span><div><h2>Identificação</h2><p>Dados vinculados à sua conta</p></div></div><div className="identity-grid"><label>Nome<input value={customer?.name ?? ""} readOnly /></label><label>E-mail<input value={customer?.email ?? ""} readOnly /></label></div></section>

        <section className="checkout-card"><div className="section-title"><span>2</span><div><h2>Endereço de entrega</h2><p>Escolha um endereço salvo ou cadastre outro</p></div></div>
          {addresses.length > 0 && <div className="saved-addresses">{addresses.map((address) => <label key={address.id} className={selectedAddress === address.id ? "selected" : ""}><input type="radio" name="savedAddress" checked={selectedAddress === address.id} onChange={() => setSelectedAddress(address.id)} /><strong>{address.label}</strong><span>{address.street}, {address.number} — {address.city}/{address.state}</span></label>)}<button type="button" onClick={() => setSelectedAddress("new")}>+ Usar outro endereço</button></div>}
          {selectedAddress === "new" && <div className="address-grid"><label className="wide">Nome de quem recebe<input name="recipientName" defaultValue={customer?.name ?? ""} required /></label><label>Telefone<input name="phone" inputMode="tel" defaultValue={customer?.phone ?? ""} required /></label><label>CEP<input name="postalCode" inputMode="numeric" maxLength={9} required /></label><label className="wide">Rua<input name="street" required /></label><label>Número<input name="number" required /></label><label>Complemento<input name="complement" /></label><label>Bairro<input name="neighborhood" required /></label><label>Cidade<input name="city" required /></label><label>UF<input name="state" maxLength={2} required /></label><label>Identificação<input name="label" defaultValue="Principal" required /></label><label className="checkbox wide"><input name="isDefault" type="checkbox" defaultChecked />Salvar como endereço principal</label></div>}
        </section>

        <section className="checkout-card"><div className="section-title"><span>3</span><div><h2>Entrega</h2><p>Condição calculada pelo valor do carrinho</p></div></div><div className="delivery-box"><span aria-hidden="true">🚚</span><div><strong>{cart.summary.qualifiesForFreeShipping ? "Frete grátis conquistado" : "Cotação de entrega pendente"}</strong><p>{cart.summary.qualifiesForFreeShipping ? "Você alcançou a meta de R$ 600,00." : `Faltam ${money.format(cart.summary.freeShippingRemainingCents / 100)} para frete grátis.`}</p></div></div></section>

        <section className="checkout-card"><div className="section-title"><span>4</span><div><h2>Pagamento</h2><p>Escolha Pix ou cartão de crédito</p></div></div><div className="payment-options"><label className={paymentMethod === "PIX" ? "selected" : ""}><input type="radio" checked={paymentMethod === "PIX"} onChange={() => { setPaymentMethod("PIX"); setInstallments(1); }} /><strong>Pix</strong><span>3% de desconto</span></label><label className={paymentMethod === "CREDIT_CARD" ? "selected" : ""}><input type="radio" checked={paymentMethod === "CREDIT_CARD"} onChange={() => setPaymentMethod("CREDIT_CARD")} /><strong>Cartão de crédito</strong><span>Até {maxInstallments}x sem juros</span></label></div>{paymentMethod === "CREDIT_CARD" && <label className="installments">Parcelamento<select value={installments} onChange={(event) => setInstallments(Number(event.target.value))}>{installmentOptions.map((amount) => <option key={amount} value={amount}>{amount}x de {money.format(cart.summary.subtotalCents / amount / 100)} sem juros</option>)}</select></label>}</section>

        {error && <p className="checkout-error" role="alert">{error}</p>}
        {completed && <p className="checkout-success" role="status">Dados revisados. O checkout está pronto para a integração segura do pagamento.</p>}
        <button className="checkout-submit" type="submit" disabled={busy}>{busy ? "Preparando checkout..." : completed ? "Checkout preparado" : "Continuar para pagamento"}</button>
      </form>

      <aside className="order-summary"><small>RESUMO DO PEDIDO</small><h2>Sua rotina BEYOU</h2><div className="summary-items">{cart.items.map((item) => <article key={item.id}><div><strong>{item.productName}</strong><span>1 unidade</span></div><b>{money.format(item.lineTotalCents / 100)}</b></article>)}</div><dl><div><dt>Subtotal</dt><dd>{money.format(cart.summary.subtotalCents / 100)}</dd></div>{paymentMethod === "PIX" && <div className="discount"><dt>Desconto Pix</dt><dd>- {money.format(pixDiscount / 100)}</dd></div>}<div><dt>Entrega</dt><dd>{cart.summary.qualifiesForFreeShipping ? "Grátis" : "A calcular"}</dd></div><div className="total"><dt>Total</dt><dd>{estimatedTotal === null ? "Após o frete" : money.format(estimatedTotal / 100)}</dd></div></dl><p>Compra segura • Dados protegidos • Suporte BEYOU</p></aside>
    </div>
  </main>;
}
