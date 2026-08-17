# Customer Area

The first Customer Area package replaces demonstration values with authenticated, customer-owned data.

- The profile name and role come from the current Supabase profile.
- The dashboard reads only the signed-in customer's orders and order items under RLS.
- The current post-purchase stage is derived from the latest real order.
- No BCoins balance, subscription, protocol adherence or evolution is simulated.
- First access, term acceptance, anamnesis, protocol and check-ins remain explicit next modules.

This package is a composition layer: it does not write to Orders or access private payment tables.

## First access

- Only customers with an approved order can enter first access.
- The active term is versioned and its exact body is stored in `legal_documents`.
- Acceptance records customer, document, date and limited technical context.
- RLS allows customers to read only their own onboarding and acceptance history.
- The `accept_customer_terms` operation is idempotent and validates the active document server-side.
- Anamnesis entry remains blocked until acceptance. The clinical questionnaire itself is the next package and is not simulated here.

## Anamnesis

- Five progressive sections cover the minimum approved business-rule groups: objective and measurements, routine, physical activity, food restrictions/preferences, and health history.
- Every step is validated in the application and constrained again in PostgreSQL.
- One draft per customer is saved progressively and can be resumed.
- Health data is readable only by its owner under forced RLS and is never exposed to affiliates.
- Completion requires explicit sensitive-health-data consent (`health-data-v1`) and every required answer.
- Completed assessments are immutable to the customer and versioned for future cycles.
- A successful completion updates onboarding and writes one idempotent `assessment.completed` domain event.
- No AI plan is generated in this package. The future generation must reference the completed assessment ID and cannot diagnose or prescribe.
