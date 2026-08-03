import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout keeps business logic outside presentation", async () => {
  const service = await read("modules/checkout/application/cart-service.ts");
  const repository = await read("modules/checkout/infrastructure/supabase-cart-repository.ts");
  assert.match(service, /getOrCreateActive/);
  assert.match(service, /PRODUCT_ALREADY_IN_CART/);
  assert.match(repository, /cart_summaries/);
});

test("checkout repository uses explicit columns", async () => {
  const repository = await read("modules/checkout/infrastructure/supabase-cart-repository.ts");
  assert.doesNotMatch(repository, /select\(["'`]\*["'`]\)/);
  assert.match(repository, /free_shipping_remaining_cents/);
});

test("checkout authenticates before every customer operation", async () => {
  const service = await read("modules/checkout/application/cart-service.ts");
  assert.match(service, /CartAuthenticationError/);
  assert.match(service, /currentUserId/);
});

test("checkout contains no subscription implementation", async () => {
  const files = await Promise.all([
    "modules/checkout/domain/cart.ts",
    "modules/checkout/application/cart-service.ts",
    "modules/checkout/infrastructure/supabase-cart-repository.ts",
  ].map(read));
  for (const source of files) assert.doesNotMatch(source, /subscription|assinatura/i);
});
