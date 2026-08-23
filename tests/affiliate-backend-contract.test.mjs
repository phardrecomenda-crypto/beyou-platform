import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("affiliate backend keeps identity and writes on the server",async()=>{
  const [service,repository]=await Promise.all([
    read("modules/affiliates/application/affiliate-service.ts"),
    read("modules/affiliates/infrastructure/supabase-affiliate-repository.ts"),
  ]);
  assert.match(service,/currentUserId/);assert.match(service,/AFFILIATE_NOT_ACTIVE/);
  assert.doesNotMatch(service,/userId:\s*z\./);
  assert.match(repository,/adminClient\.from\("affiliate_links"\)\.insert/);
  assert.match(repository,/rpc\("generate_affiliate_commissions"/);
});

test("commission engine is private, idempotent and distinguishes remarketing",async()=>{
  const migration=await read("supabase/migrations/20260811175403_affiliate_commission_engine.sql");
  assert.match(migration,/ORDER_NOT_COMMISSIONABLE/);
  assert.match(migration,/NO_ATTRIBUTION/);
  assert.match(migration,/REMARKETING_AFFILIATE_15/);
  assert.match(migration,/REMARKETING_COMPANY_5/);
  assert.match(migration,/on conflict \(idempotency_key\)/);
  assert.match(migration,/grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(migration,/grant execute[\s\S]*to authenticated/);
});

test("affiliate link input is normalized and restricted to internal destinations",async()=>{
  const [service,repository]=await Promise.all([
    read("modules/affiliates/application/affiliate-service.ts"),
    read("modules/affiliates/infrastructure/supabase-affiliate-repository.ts"),
  ]);
  assert.match(service,/toLowerCase/);assert.match(service,/regex\(\/\^\\\//);
  assert.match(repository,/CODE_UNAVAILABLE/);
});

test("affiliate applications require identity and admin review",async()=>{
  const [service,repository,migration]=await Promise.all([
    read("modules/affiliates/application/affiliate-service.ts"),
    read("modules/affiliates/infrastructure/supabase-affiliate-repository.ts"),
    read("supabase/migrations/20260811182557_affiliate_application_workflow.sql"),
  ]);
  assert.match(service,/APPLICATION_EXISTS/);
  assert.match(service,/isAdministrator/);
  assert.match(repository,/requested_role:"affiliate"/);
  assert.match(repository,/review_affiliate_application/);
  assert.match(migration,/security definer/);
  assert.match(migration,/ADMIN_REQUIRED/);
  assert.match(migration,/grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(migration,/grant execute[\s\S]*to authenticated/);
});
