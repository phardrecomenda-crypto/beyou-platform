import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout validates address, payment and installments with Zod", async () => {
  const service = await read("modules/checkout/application/checkout-service.ts");
  assert.match(service, /z\.object/);
  assert.match(service, /CHECKOUT_INSTALLMENTS|INSTALLMENTS_INVALID/);
  assert.match(service, /replace\(\/\\D\/g/);
});

test("checkout never accepts financial totals from presentation", async () => {
  const domain = await read("modules/checkout/domain/checkout.ts");
  const actions = await read("app/checkout/actions.ts");
  const startInput = domain.slice(domain.indexOf("export type StartCheckoutInput"), domain.indexOf("export class CheckoutAuthenticationError"));
  assert.doesNotMatch(startInput, /subtotal|discount|shipping|total|userId/);
  assert.doesNotMatch(actions, /service_role|supabase_secret/i);
});

test("repository uses explicit columns and ownership filters", async () => {
  const repository = await read("modules/checkout/infrastructure/supabase-checkout-repository.ts");
  assert.doesNotMatch(repository, /select\(["'`]\*["'`]\)/);
  assert.match(repository, /\.eq\("user_id", userId\)/);
  assert.match(repository, /customer_addresses/);
  assert.match(repository, /user_id:\s*userId/);
  assert.match(repository, /checkout_drafts/);
});

test("server actions return stable error codes and revalidate checkout", async () => {
  const actions = await read("app/checkout/actions.ts");
  assert.match(actions, /CheckoutAuthenticationError/);
  assert.match(actions, /CheckoutValidationError/);
  assert.match(actions, /revalidatePath\("\/checkout"\)/);
});

test("checkout excludes subscriptions", async () => {
  const sources = await Promise.all([
    "modules/checkout/domain/checkout.ts",
    "modules/checkout/application/checkout-service.ts",
    "modules/checkout/infrastructure/supabase-checkout-repository.ts",
    "app/checkout/actions.ts",
  ].map(read));
  for (const source of sources) assert.doesNotMatch(source, /subscription|assinatura/i);
});
