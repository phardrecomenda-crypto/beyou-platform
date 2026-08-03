begin;

do $$
begin
  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'customer_addresses' and rowsecurity
  ) then raise exception 'customer_addresses must have RLS'; end if;

  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'checkout_drafts' and rowsecurity
  ) then raise exception 'checkout_drafts must have RLS'; end if;

  if has_table_privilege('anon', 'public.customer_addresses', 'SELECT')
    or has_table_privilege('anon', 'public.checkout_drafts', 'SELECT')
  then raise exception 'anon must not access checkout customer data'; end if;

  if not has_column_privilege('authenticated', 'public.checkout_drafts', 'payment_method', 'INSERT')
    or has_column_privilege('authenticated', 'public.checkout_drafts', 'subtotal_cents', 'INSERT')
    or has_column_privilege('authenticated', 'public.checkout_drafts', 'total_cents', 'UPDATE')
  then raise exception 'checkout financial column privileges are invalid'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'checkout_drafts'
      and policyname = 'checkout_drafts_select_own'
  ) then raise exception 'checkout own-row policy missing'; end if;
end
$$;

rollback;
