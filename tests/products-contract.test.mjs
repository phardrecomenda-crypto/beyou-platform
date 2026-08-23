import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("presentation does not query products directly", async () => {
  const pages = await Promise.all(["app/page.tsx", "app/loja/page.tsx", "app/loja/[slug]/page.tsx"].map(read));
  for (const source of pages) assert.equal(source.includes('.from("products")'), false);
});

test("official catalog prices and sizes are versioned", async () => {
  const sql = await read("supabase/migrations_archive_unapplied/20260803190000_products_audit_catalog.sql");
  for (const cents of [21590, 17810, 10790, 40310]) assert.match(sql, new RegExp(`price_cents=${cents}`));
  assert.match(sql, /210 g/);
  assert.doesNotMatch(sql, /300 g/);
});

test("product mutations require active administrators", async () => {
  const [authorization, sql] = await Promise.all([
    read("modules/products/application/authorization.ts"),
    read("supabase/migrations/20260818124952_products_admin_schema_alignment.sql"),
  ]);
  assert.match(authorization, /select\("role"\)\.eq\("id", userData\.user\.id\)/);
  assert.match(authorization, /data\.role === "admin"/);
  assert.doesNotMatch(authorization, /status/);
  assert.match(sql, /p\.role = 'admin'/);
  assert.match(sql, /products_admin_manage/);
});

test("product writes keep the production compatibility columns synchronized", async () => {
  const repository = await read("modules/products/infrastructure/supabase-product-repository.ts");
  for (const field of ["price", "old_price", "active", "availability", "becoins"]) {
    assert.match(repository, new RegExp(`\\b${field}\\b`));
  }
});

test("product media restricts writes and limits files", async () => {
  const sql = await read("supabase/migrations_archive_unapplied/20260803173000_product_media_storage.sql");
  assert.match(sql, /5242880/);
  assert.match(sql, /image\/webp/);
  assert.match(sql, /Administrators upload product media/);
  assert.doesNotMatch(sql, /service_role/);
});

test("checkout specification preserves approved commercial rules", async () => {
  const specification = await read("docs/CHECKOUT_SPECIFICATION.md");
  assert.match(specification, /R\$ 600,00/);
  assert.match(specification, /Máximo de uma unidade/);
  assert.match(specification, /3% de desconto/);
  assert.match(specification, /3 parcelas sem juros/);
  assert.match(specification, /6 parcelas sem juros/);
  assert.match(specification, /10 parcelas sem juros/);
});

test("product details expose only label-governed usage metadata", async () => {
  const domain = await read("modules/products/domain/product.ts");
  const detail = await read("app/loja/[slug]/page.tsx");
  assert.match(domain, /productHighlights/);
  assert.match(domain, /Modo de uso/);
  assert.match(detail, /productHighlights\(data\)/);
  assert.match(detail, /ROTINA BEYOU/);
});

test("repository queries use explicit columns", async () => {
  const repository = await read("modules/products/infrastructure/supabase-product-repository.ts");
  assert.doesNotMatch(repository, /select\(["'`]\*["'`]\)/);
  for (const field of ["id", "slug", "sku", "name", "price_cents", "stock_quantity", "status"]) {
    assert.match(repository, new RegExp(`\\b${field}\\b`));
  }
});
