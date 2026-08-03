import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { requireProductAdministrator } from "../../../modules/products/application/authorization";
import { createProductService } from "../../../modules/products/infrastructure/product-factory";
import { ProductForm } from "../../../modules/products/presentation/product-form";
import { archiveProductAction, createProductAction, updateProductAction } from "./actions";
import "./products-admin.css";

export default async function ProductsAdministrationPage() {
  const client=await createServerSupabaseClient(); if(!await requireProductAdministrator(client)) redirect("/minha-area");
  const products=await createProductService(client).listAdministration();
  return <main className="admin-products"><header><Link href="/" className="admin-brand"><b>BE</b>YOU<small>Administração</small></Link><div><Link href="/loja">Ver loja</Link><Link href="/minha-area">Minha área</Link></div></header><section className="admin-container"><div className="admin-title"><small>FASE 04 · PRODUCTS</small><h1>Catálogo de produtos</h1><p>Produtos, preços, disponibilidade e estoque da BEYOU.</p></div><details className="admin-create"><summary>Adicionar produto <span>＋</span></summary><ProductForm action={createProductAction} submitLabel="Criar produto"/></details><section className="admin-product-list" aria-label="Produtos cadastrados">{products.map(product=><details className="admin-product" key={product.id}><summary><div><span className={`status ${product.status.toLowerCase()}`}>{product.status}</span><strong>{product.name}</strong><small>{product.sku} · Estoque {product.stockQuantity}</small></div><b>Editar</b></summary><ProductForm product={product} action={updateProductAction} submitLabel="Salvar alterações"/><form action={archiveProductAction}><input type="hidden" name="id" value={product.id}/><button className="archive-button">Arquivar produto</button></form></details>)}</section></section></main>;
}
