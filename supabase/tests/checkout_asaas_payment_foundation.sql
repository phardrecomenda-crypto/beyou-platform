begin;
do $$
begin
  if not public.is_valid_cpf('529.982.247-25') then raise exception 'valid CPF rejected'; end if;
  if public.is_valid_cpf('111.111.111-11') then raise exception 'repeated CPF accepted'; end if;
  if public.is_valid_cpf('529.982.247-24') then raise exception 'invalid checksum accepted'; end if;
  if has_table_privilege('anon', 'public.payment_attempts', 'SELECT')
    or has_table_privilege('authenticated', 'public.payment_attempts', 'INSERT')
    or has_table_privilege('authenticated', 'public.asaas_webhook_events', 'SELECT')
  then raise exception 'payment privileges are unsafe'; end if;
  if not has_column_privilege('authenticated', 'public.billing_profiles', 'cpf', 'INSERT')
  then raise exception 'billing CPF insert unavailable'; end if;
end
$$;
rollback;
