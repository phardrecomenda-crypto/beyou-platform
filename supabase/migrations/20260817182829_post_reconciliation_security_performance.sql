begin;

drop policy if exists asaas_customers_deny_clients on public.asaas_customers;
create policy asaas_customers_deny_clients on public.asaas_customers
for all to anon, authenticated using (false) with check (false);

drop policy if exists asaas_webhook_events_deny_clients on public.asaas_webhook_events;
create policy asaas_webhook_events_deny_clients on public.asaas_webhook_events
for all to anon, authenticated using (false) with check (false);

drop policy if exists coupons_deny_clients on public.coupons;
create policy coupons_deny_clients on public.coupons
for all to anon, authenticated using (false) with check (false);

drop policy if exists customer_domain_events_deny_clients on public.customer_domain_events;
create policy customer_domain_events_deny_clients on public.customer_domain_events
for all to anon, authenticated using (false) with check (false);

drop policy if exists wallet_entries_select_own on public.affiliate_wallet_entries;
create policy wallet_entries_select_own on public.affiliate_wallet_entries
for select to authenticated using (affiliate_user_id = (select auth.uid()));

drop policy if exists payout_requests_select_own on public.affiliate_payout_requests;
create policy payout_requests_select_own on public.affiliate_payout_requests
for select to authenticated using (affiliate_user_id = (select auth.uid()));

create index if not exists affiliate_payout_requests_processed_by_idx
  on public.affiliate_payout_requests (processed_by);
create index if not exists affiliate_wallet_entries_commission_id_idx
  on public.affiliate_wallet_entries (commission_id);
create index if not exists affiliate_wallet_entries_payout_id_idx
  on public.affiliate_wallet_entries (payout_request_id);

commit;
