import "./store.css";
import "./product-highlights.css";
import "./cart.css";
import "./store-functional.css";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createProductService } from "../../modules/products/infrastructure/product-factory";
import { createCartService } from "../../modules/checkout/infrastructure/cart-factory";
import { CartAuthenticationError } from "../../modules/checkout/domain/cart";
import { CartStore } from "../../modules/checkout/presentation/cart-store";

export default async function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabaseClient();
  const products = await createProductService(supabase).listCatalog().catch(() => []);
  const cart = await createCartService(supabase).getActive().catch((error: unknown) => {
    if (error instanceof CartAuthenticationError) return null;
    return null;
  });
  return <CartStore initialCart={cart} products={products}>{children}</CartStore>;
}
