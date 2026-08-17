import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout keeps business logic outside presentation", async () => {
  const service = await read("modules/checkout/application/cart-service.ts");
  const repository = await read("modules/checkout/infrastructure/supabase-cart-repository.ts");
  assert.match(service, /getOrCreateActive/);
  assert.match(repository, /cart_summaries/);
});

test("checkout repository uses explicit columns and ownership filters", async () => {
  const repository = await read("modules/checkout/infrastructure/supabase-cart-repository.ts");
  assert.doesNotMatch(repository, /select\(["'`]\*["'`]\)/);
  assert.match(repository, /free_shipping_remaining_cents/);
  assert.match(repository, /\.eq\("user_id", userId\)/);
});

test("checkout authenticates and validates identifiers", async () => {
  const service = await read("modules/checkout/application/cart-service.ts");
  const route = await read("app/api/cart/items/route.ts");
  assert.match(service, /CartAuthenticationError/);
  assert.match(service, /currentUserId/);
  assert.match(service, /PRODUCT_ID_PATTERN/);
  assert.match(route, /max\(64\)/);
  assert.doesNotMatch(route, /\.uuid\(\)/);
  assert.match(route, /affiliate attribution failed/);
});

test("adding the same product is idempotent", async () => {
  const service = await read("modules/checkout/application/cart-service.ts");
  assert.match(service, /details\.code !== "23505"/);
  assert.doesNotMatch(service, /PRODUCT_ALREADY_IN_CART/);
});

test("checkout actions revalidate store and cart", async () => {
  const actions = await read("app/loja/cart-actions.ts");
  assert.match(actions, /revalidatePath\("\/loja", "layout"\)/);
  assert.match(actions, /revalidatePath\("\/carrinho"\)/);
  assert.doesNotMatch(actions, /service_role/);
});

test("checkout contains no subscription implementation", async () => {
  const files = await Promise.all([
    "modules/checkout/domain/cart.ts",
    "modules/checkout/application/cart-service.ts",
    "modules/checkout/infrastructure/supabase-cart-repository.ts",
  ].map(read));
  for (const source of files) assert.doesNotMatch(source, /subscription|assinatura/i);
});
