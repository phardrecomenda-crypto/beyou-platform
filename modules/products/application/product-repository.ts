import type { Product, ProductInput } from "../domain/product";

export interface ProductRepository {
  listPublished(): Promise<readonly Product[]>;
  listAll(): Promise<readonly Product[]>;
  findPublishedBySlug(slug: string): Promise<Product | null>;
  create(input: ProductInput): Promise<Product>;
  update(id: string, input: ProductInput): Promise<Product>;
  archive(id: string): Promise<void>;
}
