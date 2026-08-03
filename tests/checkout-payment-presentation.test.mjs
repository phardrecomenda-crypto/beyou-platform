import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formPath = new URL("../app/checkout/checkout-form.tsx", import.meta.url);
const actionsPath = new URL("../app/checkout/actions.ts", import.meta.url);

test("checkout submits Pix and card payments through internal endpoints", async () => {
  const source = await readFile(formPath, "utf8");
  assert.match(source, /paymentRequest\("\/api\/payments\/pix"\)/);
  assert.match(source, /paymentRequest\("\/api\/payments\/card"/);
  assert.doesNotMatch(source, /window\.location|asaas\.com/);
});

test("checkout never persists card fields", async () => {
  const source = await readFile(formPath, "utf8");
  const actions = await readFile(actionsPath, "utf8");
  assert.match(source, /cardNumber/);
  assert.match(source, /cardCcv/);
  assert.doesNotMatch(actions, /cardNumber|cardCcv|ccv/);
});

test("billing profile is saved under the authenticated user", async () => {
  const source = await readFile(actionsPath, "utf8");
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /from\("billing_profiles"\)\.upsert/);
  assert.match(source, /\{ cpf: normalizedCpf \}/);
  assert.doesNotMatch(source, /user_id: data\.user\.id|updated_at:/);
});
