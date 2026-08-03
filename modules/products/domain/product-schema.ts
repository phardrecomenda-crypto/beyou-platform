import { z } from "zod";
import { PRODUCT_STATUSES } from "./product";

const optionalUrl = z.union([z.literal(""), z.url("Informe uma URL válida.")]).transform((value) => value || null);
const optionalMoney = z.union([z.literal(""), z.coerce.number().nonnegative()]).transform((value) => value === "" ? null : Math.round(value * 100));

export const productInputSchema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens."),
  sku: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  shortDescription: z.string().trim().min(10).max(240),
  description: z.string().trim().max(5000).transform((value) => value || null),
  imageUrl: optionalUrl,
  price: optionalMoney,
  compareAtPrice: optionalMoney,
  stockQuantity: z.coerce.number().int().nonnegative().max(1_000_000),
  status: z.enum(PRODUCT_STATUSES),
  featured: z.boolean(),
}).superRefine((value, context) => {
  if (value.status === "ACTIVE" && value.price === null) context.addIssue({ code: "custom", path: ["price"], message: "Produto ativo precisa ter preço." });
  if (value.compareAtPrice !== null && value.price !== null && value.compareAtPrice < value.price) context.addIssue({ code: "custom", path: ["compareAtPrice"], message: "Preço comparativo deve ser maior ou igual ao preço atual." });
});

export function productFormData(formData: FormData) {
  return productInputSchema.parse({
    slug: formData.get("slug"), sku: formData.get("sku"), name: formData.get("name"),
    shortDescription: formData.get("shortDescription"), description: formData.get("description") ?? "",
    imageUrl: formData.get("imageUrl") ?? "", price: formData.get("price") ?? "",
    compareAtPrice: formData.get("compareAtPrice") ?? "", stockQuantity: formData.get("stockQuantity"),
    status: formData.get("status"), featured: formData.get("featured") === "on",
  });
}
