import type { SupabaseClient } from "@supabase/supabase-js";
import { ProductService } from "../application/product-service";
import { SupabaseProductRepository } from "./supabase-product-repository";

export function createProductService(client: SupabaseClient) { return new ProductService(new SupabaseProductRepository(client)); }
