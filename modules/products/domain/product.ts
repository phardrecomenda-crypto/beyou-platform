export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type Product = Readonly<{
  id: string;
  slug: string;
  sku: string;
  name: string;
  shortDescription: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  stockQuantity: number;
  status: ProductStatus;
  featured: boolean;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}>;

export type ProductInput = Readonly<{
  slug: string;
  sku: string;
  name: string;
  shortDescription: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  stockQuantity: number;
  status: ProductStatus;
  featured: boolean;
}>;

export type ProductHighlight = Readonly<{
  label: string;
  value: string;
}>;

function metadataText(metadata: Readonly<Record<string, unknown>>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function productHighlights(product: Product): readonly ProductHighlight[] {
  const candidates: readonly ProductHighlight[] = [
    { label: "Conteúdo", value: metadataText(product.metadata, "size") ?? "" },
    { label: "Momento", value: metadataText(product.metadata, "moment") ?? "" },
    { label: "Sabor", value: metadataText(product.metadata, "flavor") ?? "" },
    { label: "Modo de uso", value: metadataText(product.metadata, "usage") ?? "" },
  ];

  return candidates.filter((highlight) => highlight.value.length > 0);
}
