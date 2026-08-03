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
