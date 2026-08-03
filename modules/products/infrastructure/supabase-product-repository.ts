import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product, ProductInput, ProductStatus } from "../domain/product";
import type { ProductRepository } from "../application/product-repository";

type ProductRow = { id:string;slug:string;sku:string;name:string;short_description:string;description:string|null;image_url:string|null;price_cents:number|null;compare_at_price_cents:number|null;stock_quantity:number;status:ProductStatus;featured:boolean;metadata:Record<string,unknown>;created_at:string;updated_at:string };
const fields = "id, slug, sku, name, short_description, description, image_url, price_cents, compare_at_price_cents, stock_quantity, status, featured, metadata, created_at, updated_at";

function map(row: ProductRow): Product { return { id:row.id,slug:row.slug,sku:row.sku,name:row.name,shortDescription:row.short_description,description:row.description,imageUrl:row.image_url,priceCents:row.price_cents,compareAtPriceCents:row.compare_at_price_cents,stockQuantity:row.stock_quantity,status:row.status,featured:row.featured,metadata:row.metadata,createdAt:row.created_at,updatedAt:row.updated_at }; }
function payload(input: ProductInput) { return { slug:input.slug,sku:input.sku,name:input.name,short_description:input.shortDescription,description:input.description,image_url:input.imageUrl,price_cents:input.priceCents,compare_at_price_cents:input.compareAtPriceCents,stock_quantity:input.stockQuantity,status:input.status,featured:input.featured }; }

export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly client: SupabaseClient) {}
  async listPublished() { const {data,error}=await this.client.from("products").select(fields).eq("status","ACTIVE").order("featured",{ascending:false}).order("created_at",{ascending:false}); if(error) throw error; return (data as ProductRow[]).map(map); }
  async listAll() { const {data,error}=await this.client.from("products").select(fields).order("created_at",{ascending:false}); if(error) throw error; return (data as ProductRow[]).map(map); }
  async findPublishedBySlug(slug:string) { const {data,error}=await this.client.from("products").select(fields).eq("slug",slug).eq("status","ACTIVE").maybeSingle(); if(error) throw error; return data ? map(data as ProductRow) : null; }
  async create(input:ProductInput) { const {data,error}=await this.client.from("products").insert(payload(input)).select(fields).single(); if(error) throw error; return map(data as ProductRow); }
  async update(id:string,input:ProductInput) { const {data,error}=await this.client.from("products").update(payload(input)).eq("id",id).select(fields).single(); if(error) throw error; return map(data as ProductRow); }
  async archive(id:string) { const {error}=await this.client.from("products").update({status:"ARCHIVED",featured:false}).eq("id",id); if(error) throw error; }
}
