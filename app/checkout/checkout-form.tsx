"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { Cart } from "../../modules/checkout/domain/cart";
import type { CheckoutCustomer, CustomerAddress } from "../../modules/checkout/domain/checkout";
import { createCustomerAddress, saveBillingProfile, startCheckout } from "./actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const field = (form: FormData, name: string) => String(form.get(name) ?? "");
type PaymentResult = Readonly<{ id: string; status: string; pixCopyPaste: string | null; pixEncodedImage: string | null; pixExpiresAt: string | null }>;

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }

async function paymentRequest(path: string, init?: RequestInit): Promise<PaymentResult> {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, ...init });
  const payload: unknown = await response.json();
  if (!response.ok || !isObject(payload) || !isObject(payload.payment)) {
    const code = isObject(payload) && typeof payload.code === "string" ? payload.code : "PAYMENT_PROVIDER_ERROR";
    throw new Error(code);
  }
  const payment = payload.payment;
  if (typeof payment.id !== "string" || typeof payment.status !== "string") throw new Error("PAYMENT_PROVIDER_ERROR");
  return { id: payment.id, status: payment.status, pixCopyPaste: typeof payment.pixCopyPaste === "string" ? payment.pixCopyPaste : null, pixEncodedImage: typeof payment.pixEncodedImage === "string" ? payment.pixEncodedImage : null, pixExpiresAt: typeof payment.pixExpiresAt === "string" ? payment.pixExpiresAt : null };
}

export function CheckoutForm({ cart, customer, addresses }: Readonly<{ cart: Cart; customer: CheckoutCustomer | null; addresses: readonly CustomerAddress[] }>) {
  const [selectedAddress, setSelectedAddress] = useState(addresses[0]?.id ?? "new");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [installments, setInstallments] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentResult | null>(null);
  const [busy, startTransition] = useTransition();
  const maxInstallments = cart.summary.subtotalCents <= 49_999 ? 3 : cart.summary.subtotalCents <= 99_999 ? 6 : 10;
  const pixDiscount = Math.round(cart.summary.subtotalCents * 0.03);
  const estimatedTotal = cart.summary.qualifiesForFreeShipping ? cart.summary.subtotalCents - (paymentMethod === "PIX" ? pixDiscount : 0) : null;
  const installmentOptions = useMemo(() => Array.from({ length: maxInstallments }, (_, index) => index + 1), [maxInstallments]);

  function submit(formData: FormData) {
    startTransition(async () => {
      setError(null); setPayment(null);
      let addressId = selectedAddress;
      if (selectedAddress === "new") {
        const result = await createCustomerAddress({ label: field(formData, "label"), recipientName: field(formData, "recipientName"), phone: field(formData, "phone"), postalCode: field(formData, "postalCode"), street: field(formData, "street"), number: field(formData, "number"), complement: field(formData, "complement") || null, neighborhood: field(formData, "neighborhood"), city: field(formData, "city"), state: field(formData, "state"), isDefault: formData.get("isDefault") === "on" });
        if (!result.ok) { setError(result.code === "ADDRESS_INVALID" ? "Revise os dados do endereço." : "Não foi possível salvar o endereço."); return; }
        addressId = result.address.id; setSelectedAddress(addressId);
      }
      const checkout = await startCheckout({ addressId, paymentMethod, installments: paymentMethod === "PIX" ? 1 : installments });
      if (!checkout.ok) { setError(checkout.code === "INSTALLMENTS_INVALID" ? "O parcelamento escolhido não está disponível." : "Não foi possível preparar o checkout."); return; }
      const billing = await saveBillingProfile(field(formData, "cpf"));
      if (!billing.ok) { setError(billing.code === "CPF_INVALID" ? "Informe um CPF válido." : "Não foi possível salvar os dados de cobrança."); return; }
      try {
        const result = paymentMethod === "PIX"
          ? await paymentRequest("/api/payments/pix")
          : await paymentRequest("/api/payments/card", { body: JSON.stringify({ holderName: field(formData, "cardHolderName"), number: field(formData, "cardNumber"), expiryMonth: field(formData, "cardExpiryMonth"), expiryYear: field(formData, "cardExpiryYear"), ccv: field(formData, "cardCcv") }) });
        setPayment(result);
      } catch (paymentError) {
        const code = paymentError instanceof Error ? paymentError.message : "PAYMENT_PROVIDER_ERROR";
        const messages: Record<string, string> = { CARD_INVALID: "Revise os dados do cartão.", PHONE_REQUIRED: "Informe um telefone com DDD no endereço de entrega.", CHECKOUT_NOT_READY: "O checkout expirou. Revise os dados e tente novamente.", PAYMENT_CONFIGURATION_MISSING: "O ambiente de pagamento ainda não está configurado.", PAYMENT_PROVIDER_ERROR: "O pagamento não pôde ser processado. Tente novamente." };
        setError(messages[code] ?? messages.PAYMENT_PROVIDER_ERROR);
      }
    });
  }

  return <main className="checkout-page">
    <header className="checkout-header">
      <Link className="checkout-brand" href="/loja" aria-label="Voltar para a loja"><span>BE<b>YOU</b></span><small>Nutrition</small></Link>
      <nav className="checkout-steps" aria-label="Etapas da compra"><span className="active"><b>1</b><em>Dados</em></span><i /><span className="active"><b>2</b><em>Pagamento</em></span><i /><span><b>3</b><em>Confirmação</em></span></nav>
      <div className="secure-checkout"><span aria-hidden="true">✓</span><small>Checkout seguro</small></div>
    </header>
    <div className="checkout-shell">
      <form action={submit} className="checkout-content">
        <Link className="back-to-store" href="/loja?cart=open"><span aria-hidden="true">←</span> Voltar ao carrinho</Link>
        <section className="checkout-hero"><small>FINALIZE SUA COMPRA</small><h1>Falta pouco para cuidar de você.</h1><p>Revise seu pedido, confirme a entrega e escolha como deseja pagar.</p></section>
        <section className="checkout-card"><div className="section-title"><span>1</span><div><h2>Identificação</h2><p>Dados vinculados à sua conta</p></div></div><div className="identity-grid"><label>Nome<input value={customer?.name ?? ""} readOnly /></label><label>E-mail<input value={customer?.email ?? ""} readOnly /></label><label>CPF para cobrança<input name="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" maxLength={14} required /></label></div></section>
        <section className="checkout-card"><div className="section-title"><span>2</span><div><h2>Endereço de entrega</h2><p>Escolha um endereço salvo ou cadastre outro</p></div></div>
          {addresses.length > 0 && <div className="saved-addresses">{addresses.map((address) => <label key={address.id} className={selectedAddress === address.id ? "selected" : ""}><input type="radio" name="savedAddress" checked={selectedAddress === address.id} onChange={() => setSelectedAddress(address.id)} /><strong>{address.label}</strong><span>{address.street}, {address.number} — {address.city}/{address.state}</span></label>)}<button type="button" onClick={() => setSelectedAddress("new")}>+ Usar outro endereço</button></div>}
          {selectedAddress === "new" && <div className="address-grid"><label className="wide">Nome de quem recebe<input name="recipientName" defaultValue={customer?.name ?? ""} required /></label><label>Telefone<input name="phone" inputMode="tel" defaultValue={customer?.phone ?? ""} required /></label><label>CEP<input name="postalCode" inputMode="numeric" maxLength={9} required /></label><label className="wide">Rua<input name="street" required /></label><label>Número<input name="number" required /></label><label>Complemento<input name="complement" /></label><label>Bairro<input name="neighborhood" required /></label><label>Cidade<input name="city" required /></label><label>UF<input name="state" maxLength={2} required /></label><label>Identificação<input name="label" defaultValue="Principal" required /></label><label className="checkbox wide"><input name="isDefault" type="checkbox" defaultChecked />Salvar como endereço principal</label></div>}
        </section>
        <section className="checkout-card"><div className="section-title"><span>3</span><div><h2>Entrega</h2><p>Condição calculada pelo valor do carrinho</p></div></div><div className="delivery-box"><span aria-hidden="true">🚚</span><div><strong>{cart.summary.qualifiesForFreeShipping ? "Frete grátis conquistado" : "Cotação de entrega pendente"}</strong><p>{cart.summary.qualifiesForFreeShipping ? "Você alcançou a meta de R$ 600,00." : `Faltam ${money.format(cart.summary.freeShippingRemainingCents / 100)} para frete grátis.`}</p></div></div></section>
        <section className="checkout-card"><div className="section-title"><span>4</span><div><h2>Pagamento</h2><p>Escolha Pix ou cartão de crédito</p></div></div><div className="payment-options"><label className={paymentMethod === "PIX" ? "selected" : ""}><input type="radio" name="paymentMethod" checked={paymentMethod === "PIX"} onChange={() => { setPaymentMethod("PIX"); setInstallments(1); }} /><strong>Pix</strong><span>3% de desconto</span></label><label className={paymentMethod === "CREDIT_CARD" ? "selected" : ""}><input type="radio" name="paymentMethod" checked={paymentMethod === "CREDIT_CARD"} onChange={() => setPaymentMethod("CREDIT_CARD")} /><strong>Cartão de crédito</strong><span>Até {maxInstallments}x sem juros</span></label></div>
          {paymentMethod === "CREDIT_CARD" && <div className="card-fields"><label className="wide">Nome impresso no cartão<input name="cardHolderName" autoComplete="cc-name" required /></label><label className="wide">Número do cartão<input name="cardNumber" inputMode="numeric" autoComplete="cc-number" maxLength={19} required /></label><label>Mês<input name="cardExpiryMonth" inputMode="numeric" autoComplete="cc-exp-month" placeholder="MM" maxLength={2} required /></label><label>Ano<input name="cardExpiryYear" inputMode="numeric" autoComplete="cc-exp-year" placeholder="AAAA" maxLength={4} required /></label><label>CVV<input name="cardCcv" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required /></label><label>Parcelamento<select value={installments} onChange={(event) => setInstallments(Number(event.target.value))}>{installmentOptions.map((amount) => <option key={amount} value={amount}>{amount}x de {money.format(cart.summary.subtotalCents / amount / 100)} sem juros</option>)}</select></label><p className="card-security wide">Os dados do cartão são enviados diretamente para processamento e não são armazenados pela BEYOU.</p></div>}
        </section>
        {error && <p className="checkout-error" role="alert">{error}</p>}
        {payment?.pixCopyPaste && <section className="payment-result" aria-live="polite"><span>Pagamento Pix gerado</span><h2>Escaneie o QR Code</h2>{payment.pixEncodedImage && <img src={`data:image/png;base64,${payment.pixEncodedImage}`} alt="QR Code Pix para pagamento" width="220" height="220" />}<label>Pix copia-e-cola<textarea value={payment.pixCopyPaste} readOnly rows={4} onFocus={(event) => event.currentTarget.select()} /></label><p>Após o pagamento, a confirmação será atualizada automaticamente.</p></section>}
        {payment && !payment.pixCopyPaste && <p className="checkout-success" role="status">Pagamento enviado com segurança. Status: {payment.status}.</p>}
        <button className="checkout-submit" type="submit" disabled={busy || Boolean(payment)}><span>{busy ? "Processando pagamento..." : payment ? "Pagamento enviado" : paymentMethod === "PIX" ? "Gerar Pix" : "Pagar com cartão"}</span><b aria-hidden="true">→</b></button>
        <div className="checkout-trust"><span>✓ Dados protegidos</span><span>✓ Pagamento seguro</span><span>✓ Suporte BEYOU</span></div>
      </form>
      <aside className="order-summary"><div className="summary-heading"><div><small>RESUMO DO PEDIDO</small><h2>Sua rotina BEYOU</h2></div><Link href="/loja?cart=open">Editar</Link></div><div className="summary-items">{cart.items.map((item, index) => <article key={item.id}><div className={`summary-product product-${index % 3}`} aria-hidden="true"><small>BE</small><strong>{item.productName.replace(/^Be/i, "")}</strong></div><div className="summary-copy"><strong>{item.productName}</strong><span>1 unidade</span></div><b>{money.format(item.lineTotalCents / 100)}</b></article>)}</div><dl><div><dt>Subtotal</dt><dd>{money.format(cart.summary.subtotalCents / 100)}</dd></div>{paymentMethod === "PIX" && <div className="discount"><dt>Desconto Pix</dt><dd>- {money.format(pixDiscount / 100)}</dd></div>}<div><dt>Entrega</dt><dd>{cart.summary.qualifiesForFreeShipping ? "Grátis" : "A calcular"}</dd></div><div className="total"><dt>Total</dt><dd>{estimatedTotal === null ? "Após o frete" : money.format(estimatedTotal / 100)}</dd></div></dl><p><b aria-hidden="true">✦</b> Cuidar de você é a nossa fórmula.</p></aside>
    </div>
  </main>;
}
