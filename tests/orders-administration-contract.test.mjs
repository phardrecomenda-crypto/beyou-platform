import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("fulfillment transitions are atomic, ordered and private",async()=>{
  const migration=await read("supabase/migrations/20260804031000_orders_fulfillment_workflow.sql");
  assert.match(migration,/for update/);
  assert.match(migration,/ORDER_TRANSITION_INVALID/);
  assert.match(migration,/TRACKING_REQUIRED/);
  assert.match(migration,/insert into public\.order_status_history/);
  assert.match(migration,/grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(migration,/grant execute[\s\S]*to authenticated/);
});

test("order administration authenticates roles on every mutation",async()=>{
  const [authorization,actions]=await Promise.all([read("modules/orders/application/authorization.ts"),read("app/admin/pedidos/actions.ts")]);
  assert.match(authorization,/SUPER_ADMIN/); assert.match(authorization,/ADMIN/); assert.match(authorization,/SUPORTE/);
  assert.match(actions,/requireOrderOperator/); assert.match(actions,/operator\.role==="SUPORTE"/);
  assert.match(actions,/rpc\("update_order_fulfillment"/);
});

test("shipping requires carrier and tracking in presentation",async()=>{
  const form=await read("app/admin/pedidos/order-status-form.tsx");
  assert.match(form,/next==="SHIPPED"/); assert.match(form,/name="shippingCarrier" required/); assert.match(form,/name="trackingCode" required/);
});
