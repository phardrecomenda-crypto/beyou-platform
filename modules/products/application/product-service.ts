import type { ProductInput } from "../domain/product";
import type { ProductRepository } from "./product-repository";

export class ProductService {
  constructor(private readonly repository: ProductRepository) {}
  listCatalog() { return this.repository.listPublished(); }
  listAdministration() { return this.repository.listAll(); }
  getPublished(slug: string) { return this.repository.findPublishedBySlug(slug); }
  create(input: ProductInput) { return this.repository.create(input); }
  update(id: string, input: ProductInput) { return this.repository.update(id, input); }
  archive(id: string) { return this.repository.archive(id); }
}
