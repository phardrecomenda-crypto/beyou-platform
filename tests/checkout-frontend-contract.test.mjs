import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("store routes use the shared cart presentation", async () => {
  const files = await Promise.all([
    "app/loja/layout.tsx",
    "app/loja/page.tsx",
    "app/loja/[slug]/page.tsx",
  ].map(read));
  assert.match(files[0], /CartStore/);
  assert.match(files[1], /AddToCartButton/);
  assert.match(files[2], /AddToCartButton/);
});

test("cart displays the approved shipping threshold and order bumps", async () => {
  const store = await read("modules/checkout/presentation/cart-store.tsx");
  assert.match(store, /60_000/);
  assert.match(store, /Meta: R\$ 600,00/);
  assert.match(store, /order-bumps/);
  assert.match(store, /products\.filter/);
});

test("cart supports keyboard dismissal and accessible progress", async () => {
  const store = await read("modules/checkout/presentation/cart-store.tsx");
  assert.match(store, /event\.key === "Escape"/);
  assert.match(store, /role="progressbar"/);
  assert.match(store, /aria-modal="true"/);
  assert.match(store, /document\.body\.style\.overflow/);
});

test("cart redirects unauthenticated users back to the requested drawer", async () => {
  const store = await read("modules/checkout/presentation/cart-store.tsx");
  assert.match(store, /AUTHENTICATION_REQUIRED/);
  assert.match(store, /encodeURIComponent/);
  assert.match(store, /cart=open/);
});
