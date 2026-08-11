import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("affiliate application derives identity from the server session",async()=>{
  const [page,actions]=await Promise.all([read("app/afiliados/page.tsx"),read("app/afiliados/actions.ts")]);
  assert.match(page,/submitAffiliateApplicationAction/);
  assert.match(actions,/createServerSupabaseClient/);
  assert.doesNotMatch(actions,/formData\.get\(["']userId/);
});
test("dashboard renders real ledger amounts and the remarketing-only rule",async()=>{
  const page=await read("app/afiliados/painel/page.tsx");
  assert.match(page,/dashboard\.pendingAmount/);
  assert.match(page,/dashboard\.recentCommissions/);
  assert.match(page,/Somente no remarketing validado/);
  assert.doesNotMatch(page,/R\$\s*1[.,]000/);
});
test("admin review uses protected service and explicit decisions",async()=>{
  const [page,actions]=await Promise.all([read("app/admin/afiliados/page.tsx"),read("app/afiliados/actions.ts")]);
  assert.match(page,/pendingApplications/);
  assert.match(page,/value="approved"/);
  assert.match(page,/value="rejected"/);
  assert.match(actions,/createAdminSupabaseClient/);
});
