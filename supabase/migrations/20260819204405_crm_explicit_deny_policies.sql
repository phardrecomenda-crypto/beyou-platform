create policy customer_lifecycle_deny_browser_access on public.customer_lifecycle
for all to anon, authenticated using (false) with check (false);

create policy customer_lifecycle_history_deny_browser_access on public.customer_lifecycle_history
for all to anon, authenticated using (false) with check (false);

comment on policy customer_lifecycle_deny_browser_access on public.customer_lifecycle is 'Explicit defense in depth: CRM is server-only.';
comment on policy customer_lifecycle_history_deny_browser_access on public.customer_lifecycle_history is 'Explicit defense in depth: CRM history is server-only and append-only.';
