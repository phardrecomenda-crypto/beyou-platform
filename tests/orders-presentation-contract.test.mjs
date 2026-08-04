import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("orders pages require authenticated, owned records",async()=>{
  const [service,repository,list,detail]=await Promise.all([
    read("modules/orders/application/order-service.ts"),
    read("modules/orders/infrastructure/supabase-order-repository.ts"),
    read("app/pedidos/page.tsx"),
    read("app/pedidos/[id]/page.tsx"),
  ]);
  assert.match(service,/requireUser/);
  assert.match(repository,/\.eq\("user_id", userId\)/);
  assert.match(list,/OrderAuthenticationError/);
  assert.match(detail,/notFound\(\)/);
});

test("payment watcher only redirects after an order exists",async()=>{
  const [watcher,statusRoute]=await Promise.all([
    read("app/checkout/payment-order-watcher.tsx"),
    read("app/api/orders/status/route.ts"),
  ]);
  assert.match(watcher,/payload\.order\?\.id/);
  assert.match(watcher,/router\.replace\(`\/pedido\/confirmado/);
  assert.match(statusRoute,/eq\("user_id", data\.user\.id\)/);
  assert.match(statusRoute,/eq\("provider_payment_id", paymentId\)/);
  assert.match(statusRoute,/cache-control":"no-store"/);
});

test("confirmation renders immutable order snapshots",async()=>{
  const view=await read("app/pedidos/order-view.tsx");
  for(const field of ["order.orderNumber","order.totalCents","order.recipientName","item.productSku","order.paidAt"]){
    assert.match(view,new RegExp(field.replace(".","\\.")));
  }
});
