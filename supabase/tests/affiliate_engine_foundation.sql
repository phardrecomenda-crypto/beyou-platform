begin;

do $$
declare
  v_affiliate uuid;
  v_order uuid;
  v_service uuid;
  blocked_without_service boolean := false;
  blocked_open_service boolean := false;
begin
  select id into v_affiliate from public.profiles order by created_at limit 1;
  select id into v_order from public.orders order by created_at limit 1;

  if v_affiliate is null or v_order is null then
    raise exception 'Affiliate Engine test prerequisites are missing.';
  end if;

  insert into public.affiliate_profiles(user_id, affiliate_code, focus)
  values (v_affiliate, 'test_' || replace(v_affiliate::text, '-', ''), 'affiliate')
  on conflict (user_id) do nothing;

  begin
    insert into public.sale_attributions(order_id, affiliate_user_id, attribution_type)
    values (v_order, v_affiliate, 'REMARKETING');
  exception when check_violation then
    blocked_without_service := true;
  end;

  if not blocked_without_service then
    raise exception 'Remarketing without service record was not blocked.';
  end if;

  insert into public.remarketing_service_records(
    affiliate_user_id, source, status, opened_at, sla_due_at
  ) values (
    v_affiliate, 'DATABASE_TEST', 'OPEN', now(), now() + interval '1 hour'
  ) returning id into v_service;

  begin
    insert into public.sale_attributions(
      order_id, affiliate_user_id, attribution_type, remarketing_service_record_id
    ) values (v_order, v_affiliate, 'REMARKETING', v_service);
  exception when check_violation then
    blocked_open_service := true;
  end;

  if not blocked_open_service then
    raise exception 'Incomplete remarketing service record was not blocked.';
  end if;

  update public.remarketing_service_records
     set status = 'WON',
         first_contact_at = opened_at + interval '10 minutes',
         closed_at = opened_at + interval '20 minutes',
         outcome = 'SALE_RECOVERED'
   where id = v_service;

  insert into public.sale_attributions(
    order_id, affiliate_user_id, attribution_type, remarketing_service_record_id
  ) values (v_order, v_affiliate, 'REMARKETING', v_service);

  if (select percentage from public.commission_rules where rule_key = 'DIRECT_STANDARD_20') <> 20
     or (select percentage from public.commission_rules where rule_key = 'REMARKETING_AFFILIATE_15') <> 15
     or (select percentage from public.commission_rules where rule_key = 'REMARKETING_COMPANY_5') <> 5 then
    raise exception 'Official commission percentages are inconsistent.';
  end if;
end $$;

rollback;

