import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("affiliate link stores an httpOnly first-touch cookie",async()=>{
  const route=await read("app/r/[code]/route.ts");
  assert.match(route,/httpOnly:\s*true/);
  assert.match(route,/sameSite:\s*"lax"/);
  assert.match(route,/maxAge:\s*60 \* 60 \* 24 \* 30/);
  assert.match(route,/INTERNAL_PATH/);
});
test("cart attribution is validated on the server and blocks self attribution",async()=>{
  const [capture,route]=await Promise.all([read("modules/affiliates/infrastructure/affiliate-capture.ts"),read("app/api/cart/items/route.ts")]);
  assert.match(route,/captureCartAffiliate/);
  assert.match(route,/createAdminSupabaseClient/);
  assert.match(capture,/link\.affiliate_user_id === customerUserId/);
  assert.match(capture,/\.eq\("user_id", customerUserId\)/);
  assert.match(capture,/\.is\("affiliate_link_id", null\)/);
  assert.doesNotMatch(capture,/security definer/);
});
test("paid order locks attribution before the commission engine runs",async()=>{
  const [migration,webhook]=await Promise.all([read("supabase/migrations/20260813152000_affiliate_direct_attribution_capture.sql"),read("app/api/webhooks/asaas/route.ts")]);
  assert.match(migration,/after insert on public\.orders/);
  assert.match(migration,/insert into public\.sale_attributions/);
  assert.match(migration,/'DIRECT'/);
  assert.match(webhook,/createOrderFromConfirmedPayment/);
  assert.match(webhook,/processConfirmedOrder/);
});
