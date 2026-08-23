import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("confirmed payment webhooks create orders",async()=>{
  const [route,repository]=await Promise.all([
    read("app/api/webhooks/asaas/route.ts"),
    read("modules/payments/infrastructure/supabase-payment-repository.ts"),
  ]);
  assert.match(route,/status === "CONFIRMED" \|\| status === "RECEIVED"/);
  assert.match(route,/createOrderFromConfirmedPayment\(paymentId, parsed\.data\.id\)/);
  assert.match(repository,/rpc\("create_order_from_confirmed_payment"/);
});

test("order conversion is atomic and idempotent",async()=>{
  const migration=await read("supabase/migrations_archive_unapplied/20260804024000_orders_payment_conversion.sql");
  assert.match(migration,/for update/);
  assert.match(migration,/where payment_attempt_id = selected_attempt\.id/);
  assert.match(migration,/when unique_violation/);
  assert.match(migration,/status = 'COMPLETED'/);
  assert.match(migration,/status = 'CONVERTED'/);
  assert.match(migration,/grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(migration,/grant execute[\s\S]*to authenticated/);
});
