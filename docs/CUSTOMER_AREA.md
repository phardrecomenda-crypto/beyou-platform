# Customer Area

The first Customer Area package replaces demonstration values with authenticated, customer-owned data.

- The profile name and role come from the current Supabase profile.
- The dashboard reads only the signed-in customer's orders and order items under RLS.
- The current post-purchase stage is derived from the latest real order.
- No BCoins balance, subscription, protocol adherence or evolution is simulated.
- First access, term acceptance, anamnesis, protocol and check-ins remain explicit next modules.

This package is a composition layer: it does not write to Orders or access private payment tables.
