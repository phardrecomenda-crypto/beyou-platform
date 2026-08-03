import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("Asaas secrets stay server-only",async()=>{const [admin,client,env]=await Promise.all([read("lib/supabase/admin.ts"),read("modules/payments/infrastructure/asaas-client.ts"),read(".env.example")]);assert.match(admin,/server-only/);assert.match(client,/ASAAS_API_KEY/);assert.doesNotMatch(env,/NEXT_PUBLIC_ASAAS|NEXT_PUBLIC_SUPABASE_SECRET/)});
test("Asaas failures log only safe provider diagnostics",async()=>{const client=await read("modules/payments/infrastructure/asaas-client.ts");assert.match(client,/provider request failed/);assert.match(client,/status: response\.status/);assert.match(client,/errors: safeProviderErrors\(data\)/);assert.doesNotMatch(client,/console\.error\([^\n]*(apiKey|cpf|body)/)});
test("Pix uses external reference and retrieves QR code",async()=>{const client=await read("modules/payments/infrastructure/asaas-client.ts");assert.match(client,/externalReference: attemptId/);assert.match(client,/pixQrCode/);assert.doesNotMatch(client,/polling|setInterval/i)});
test("card data is never persisted",async()=>{const files=await Promise.all([read("modules/payments/infrastructure/supabase-payment-repository.ts"),read("app/api/payments/card/route.ts")]);assert.doesNotMatch(files[0],/creditCard|ccv|expiry|card\.number/);assert.doesNotMatch(files[1],/\.from\(|console\.log/)});
test("webhook validates token and is idempotent",async()=>{const route=await read("app/api/webhooks/asaas/route.ts");const repository=await read("modules/payments/infrastructure/supabase-payment-repository.ts");assert.match(route,/timingSafeEqual/);assert.match(route,/asaas-access-token/);assert.match(repository,/23505/)});

test("webhook bypasses session login while keeping token authentication",async()=>{
  const proxy=await read("lib/supabase/proxy.ts");
  const route=await read("app/api/webhooks/asaas/route.ts");
  assert.match(proxy,/PUBLIC_EXACT_PATHS[^\n]*\/api\/webhooks\/asaas/);
  assert.match(proxy,/PUBLIC_EXACT_PATHS\.has\(request\.nextUrl\.pathname\)/);
  assert.match(route,/asaas-access-token/);
  assert.match(route,/status:401/);
});
