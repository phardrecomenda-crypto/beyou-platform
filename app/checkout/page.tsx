import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { CartAuthenticationError } from "../../modules/checkout/domain/cart";
import { createCartService } from "../../modules/checkout/infrastructure/cart-factory";
import { CheckoutAuthenticationError } from "../../modules/checkout/domain/checkout";
import { createCheckoutService } from "../../modules/checkout/infrastructure/checkout-factory";
import { CheckoutForm } from "./checkout-form";
import "./checkout.css";

export default async function CheckoutPage() {
  const client = await createServerSupabaseClient();
  const cartService = createCartService(client);
  const checkoutService = createCheckoutService(client);

  try {
    const [cart, customer, addresses] = await Promise.all([
      cartService.getActive(),
      checkoutService.getCustomer(),
      checkoutService.listAddresses(),
    ]);
    if (!cart?.items.length) redirect("/loja?cart=open");
    return <CheckoutForm cart={cart} customer={customer} addresses={addresses} />;
  } catch (error) {
    if (error instanceof CartAuthenticationError || error instanceof CheckoutAuthenticationError) {
      redirect("/login?next=%2Fcheckout");
    }
    throw error;
  }
}
