drop policy if exists payment_events_no_client_access on public.payment_webhook_events;
create policy payment_events_no_client_access
on public.payment_webhook_events
for select
to anon, authenticated
using (false);
