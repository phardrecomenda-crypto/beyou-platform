"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { requireProductAdministrator } from "../../../modules/products/application/authorization";
import { productFormData } from "../../../modules/products/domain/product-schema";
import { createProductService } from "../../../modules/products/infrastructure/product-factory";

export type ProductActionState = { error?: string; success?: string };

function input(formData: FormData) {
  const value = productFormData(formData);
  return { slug:value.slug,sku:value.sku,name:value.name,shortDescription:value.shortDescription,description:value.description,imageUrl:value.imageUrl,priceCents:value.price,compareAtPriceCents:value.compareAtPrice,stockQuantity:value.stockQuantity,status:value.status,featured:value.featured };
}

function failure(error: unknown): ProductActionState {
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "Dados inválidos." };
  if (error instanceof Error && error.message.startsWith("Imagem inválida")) return { error:error.message };
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return { error: "Slug ou SKU já cadastrado." };
  return { error: "Não foi possível salvar o produto." };
}

async function context() {
  const client = await createServerSupabaseClient();
  if (!await requireProductAdministrator(client)) redirect("/minha-area");
  return { client, service:createProductService(client) };
}

async function productInput(formData: FormData) {
  const parsed=input(formData); const file=formData.get("imageFile");
  if (!(file instanceof File) || file.size === 0) return parsed;
  if (file.size > 5_242_880 || !["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)) throw new Error("Imagem inválida. Use JPG, PNG, WebP ou AVIF com até 5 MB.");
  const {client}=await context(); const extension=file.name.split(".").pop()?.toLowerCase()??"webp"; const path=`catalog/${crypto.randomUUID()}.${extension}`;
  const {error}=await client.storage.from("product-media").upload(path,file,{contentType:file.type,upsert:false,cacheControl:"31536000"}); if(error) throw error;
  const {data}=client.storage.from("product-media").getPublicUrl(path);
  return {...parsed,imageUrl:data.publicUrl};
}

export async function createProductAction(_: ProductActionState, formData: FormData): Promise<ProductActionState> {
  try { const {service}=await context(); await service.create(await productInput(formData)); revalidatePath("/admin/produtos"); revalidatePath("/loja"); return {success:"Produto criado com sucesso."}; } catch(error) { return failure(error); }
}

export async function updateProductAction(_: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const id=formData.get("id"); if(typeof id!=="string"||!id) return {error:"Produto inválido."};
  try { const {service}=await context(); await service.update(id,await productInput(formData)); revalidatePath("/admin/produtos"); revalidatePath("/loja"); return {success:"Produto atualizado com sucesso."}; } catch(error) { return failure(error); }
}

export async function archiveProductAction(formData: FormData) {
  const id=formData.get("id"); if(typeof id!=="string"||!id) return;
  const {service}=await context(); await service.archive(id); revalidatePath("/admin/produtos"); revalidatePath("/loja");
}
