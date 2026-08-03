"use client";

import { useActionState } from "react";
import type { Product, ProductStatus } from "../domain/product";
import type { ProductActionState } from "../../../app/admin/produtos/actions";

type Props = { product?: Product; action:(state:ProductActionState,data:FormData)=>Promise<ProductActionState>; submitLabel:string };
const money=(cents:number|null)=>cents===null?"":(cents/100).toFixed(2);

export function ProductForm({product,action,submitLabel}:Props) {
  const [state,formAction,pending]=useActionState(action,{});
  return <form className="admin-product-form" action={formAction}>{product&&<input type="hidden" name="id" value={product.id}/>}<div className="admin-form-grid">
    <label>Nome<input name="name" defaultValue={product?.name} required maxLength={160}/></label>
    <label>SKU<input name="sku" defaultValue={product?.sku} required maxLength={80}/></label>
    <label>Slug<input name="slug" defaultValue={product?.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"/></label>
    <label>Status<select name="status" defaultValue={product?.status??"DRAFT"}>{(["DRAFT","ACTIVE","ARCHIVED"] as ProductStatus[]).map(status=><option value={status} key={status}>{status}</option>)}</select></label>
    <label>Preço (R$)<input name="price" type="number" min="0" step="0.01" defaultValue={money(product?.priceCents??null)}/></label>
    <label>Preço comparativo (R$)<input name="compareAtPrice" type="number" min="0" step="0.01" defaultValue={money(product?.compareAtPriceCents??null)}/></label>
    <label>Estoque<input name="stockQuantity" type="number" min="0" step="1" defaultValue={product?.stockQuantity??0} required/></label>
    <label>URL atual da imagem<input name="imageUrl" type="url" defaultValue={product?.imageUrl??""}/></label><label>Nova imagem<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif"/></label>
  </div><label>Descrição curta<textarea name="shortDescription" defaultValue={product?.shortDescription} required maxLength={240}/></label><label>Descrição completa<textarea name="description" defaultValue={product?.description??""} maxLength={5000} rows={5}/></label><label className="admin-checkbox"><input type="checkbox" name="featured" defaultChecked={product?.featured}/> Produto em destaque</label>
  {state.error&&<p className="admin-message error" role="alert">{state.error}</p>}{state.success&&<p className="admin-message success" role="status">{state.success}</p>}<button className="admin-submit" disabled={pending}>{pending?"Salvando…":submitLabel}</button></form>;
}
