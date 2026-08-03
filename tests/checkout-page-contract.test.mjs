import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout page loads authenticated domain services", async () => {
  const page = await read("app/checkout/page.tsx");
  assert.match(page, /createCartService/);
  assert.match(page, /createCheckoutService/);
  assert.match(page, /redirect\("\/login\?next=%2Fcheckout"\)/);
  assert.doesNotMatch(page, /\.from\(/);
});

test("checkout presents all approved steps and payment rules", async () => {
  const form = await read("app/checkout/checkout-form.tsx");
  for (const label of ["Identificação", "Endereço de entrega", "Entrega", "Pagamento", "Desconto Pix"]) assert.match(form, new RegExp(label));
  assert.match(form, /49_999 \? 3/);
  assert.match(form, /99_999 \? 6 : 10/);
  assert.match(form, /Math\.round\(cart\.summary\.subtotalCents \* 0\.03\)/);
});

test("checkout stays internal and does not fake payment approval", async () => {
  const form = await read("app/checkout/checkout-form.tsx");
  assert.match(form, /startCheckout/);
  assert.doesNotMatch(form, /window\.location|https:\/\//);
  assert.doesNotMatch(form, /pagamento aprovado|pedido confirmado/i);
});

test("checkout is responsive and accessible", async () => {
  const [form, css] = await Promise.all([read("app/checkout/checkout-form.tsx"), read("app/checkout/checkout.css")]);
  assert.match(form, /role="alert"/);
  assert.match(form, /aria-label="Voltar para a loja"/);
  assert.match(css, /@media\(max-width:560px\)/);
});
