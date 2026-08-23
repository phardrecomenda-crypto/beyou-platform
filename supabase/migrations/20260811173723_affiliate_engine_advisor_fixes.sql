-- SPRINT 08 — Supabase advisor fixes

create index sale_attributions_remarketing_service_idx
  on public.sale_attributions (remarketing_service_record_id)
  where remarketing_service_record_id is not null;

create index company_revenue_rule_idx
  on public.company_revenue_allocations (rule_id);

create policy company_revenue_allocations_deny_client_access
  on public.company_revenue_allocations
  for select
  to authenticated
  using (false);

