-- SPRINT 08 — Idempotent commission engine

create or replace function public.generate_affiliate_commissions(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.orders;
  attribution public.sale_attributions;
  order_payload jsonb;
  normalized_status text;
  base_amount numeric(12,2);
  source_user_id uuid;
  selected_rule public.commission_rules;
  network_entry record;
  inserted_affiliate integer := 0;
  inserted_company integer := 0;
  affected integer;
begin
  select * into selected_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  order_payload := to_jsonb(selected_order);
  normalized_status := upper(coalesce(order_payload ->> 'status', ''));
  if normalized_status not in ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED') then
    raise exception using errcode = '23514', message = 'ORDER_NOT_COMMISSIONABLE';
  end if;

  base_amount := case
    when order_payload ? 'subtotal_cents' then
      round(((order_payload ->> 'subtotal_cents')::numeric - coalesce((order_payload ->> 'discount_cents')::numeric, 0)) / 100, 2)
    else
      round(coalesce((order_payload ->> 'subtotal')::numeric, 0) - coalesce((order_payload ->> 'discount')::numeric, 0), 2)
  end;
  source_user_id := nullif(order_payload ->> 'user_id', '')::uuid;

  if base_amount <= 0 then
    raise exception using errcode = '23514', message = 'ORDER_BASE_AMOUNT_INVALID';
  end if;

  select * into attribution
    from public.sale_attributions
   where order_id = p_order_id;

  if not found then
    return jsonb_build_object('status', 'NO_ATTRIBUTION', 'affiliate_entries', 0, 'company_entries', 0);
  end if;

  select * into selected_rule
    from public.commission_rules
   where rule_key = case attribution.attribution_type
     when 'REMARKETING' then 'REMARKETING_AFFILIATE_15'
     else 'DIRECT_STANDARD_20'
   end
     and active
     and valid_from <= now()
     and (valid_until is null or valid_until > now());

  if not found then
    raise exception using errcode = 'P0002', message = 'AFFILIATE_COMMISSION_RULE_NOT_FOUND';
  end if;

  insert into public.commission_ledger(
    affiliate_user_id, order_id, source_user_id, commission_type, percentage,
    base_amount, amount, status, rule_id, attribution_id, idempotency_key,
    beneficiary_type, metadata
  ) values (
    attribution.affiliate_user_id, p_order_id, source_user_id,
    case when attribution.attribution_type = 'REMARKETING' then 'direct' else 'direct' end,
    selected_rule.percentage, base_amount,
    round(base_amount * selected_rule.percentage / 100, 2), 'pending',
    selected_rule.id, attribution.id,
    'commission:' || p_order_id::text || ':' || attribution.affiliate_user_id::text || ':' || selected_rule.rule_key,
    'AFFILIATE',
    jsonb_build_object('channel', attribution.attribution_type)
  ) on conflict (idempotency_key) where idempotency_key is not null do nothing;
  get diagnostics affected = row_count;
  inserted_affiliate := inserted_affiliate + affected;

  if attribution.attribution_type = 'REMARKETING' then
    select * into selected_rule
      from public.commission_rules
     where rule_key = 'REMARKETING_COMPANY_5'
       and active
       and valid_from <= now()
       and (valid_until is null or valid_until > now());

    if not found then
      raise exception using errcode = 'P0002', message = 'REMARKETING_COMPANY_RULE_NOT_FOUND';
    end if;

    insert into public.company_revenue_allocations(
      order_id, attribution_id, rule_id, idempotency_key, percentage,
      base_amount, amount, status, metadata
    ) values (
      p_order_id, attribution.id, selected_rule.id,
      'company-allocation:' || p_order_id::text || ':' || selected_rule.rule_key,
      selected_rule.percentage, base_amount,
      round(base_amount * selected_rule.percentage / 100, 2), 'pending',
      jsonb_build_object('channel', 'REMARKETING')
    ) on conflict (idempotency_key) do nothing;
    get diagnostics inserted_company = row_count;
  else
    for network_entry in
      select n.owner_user_id, n.level, n.relationship_type
        from public.affiliate_network n
       where n.member_user_id = attribution.affiliate_user_id
         and n.active
         and n.relationship_type in ('manager', 'recruiter')
    loop
      select * into selected_rule
        from public.commission_rules
       where channel = upper(network_entry.relationship_type)
         and beneficiary_type = upper(network_entry.relationship_type)
         and network_level = case network_entry.level::text
           when 'n1' then 1 when 'n2' then 2 when 'n3' then 3
         end
         and active
         and valid_from <= now()
         and (valid_until is null or valid_until > now())
       order by valid_from desc
       limit 1;

      if found then
        insert into public.commission_ledger(
          affiliate_user_id, order_id, source_user_id, commission_type, percentage,
          base_amount, amount, status, rule_id, attribution_id, idempotency_key,
          beneficiary_type, metadata
        ) values (
          network_entry.owner_user_id, p_order_id, attribution.affiliate_user_id,
          network_entry.relationship_type || '_n' || network_entry.level::text,
          selected_rule.percentage, base_amount,
          round(base_amount * selected_rule.percentage / 100, 2), 'pending',
          selected_rule.id, attribution.id,
          'commission:' || p_order_id::text || ':' || network_entry.owner_user_id::text || ':' || selected_rule.rule_key,
          upper(network_entry.relationship_type),
          jsonb_build_object('channel', 'DIRECT', 'network_level', network_entry.level)
        ) on conflict (idempotency_key) where idempotency_key is not null do nothing;
        get diagnostics affected = row_count;
        inserted_affiliate := inserted_affiliate + affected;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'status', 'PROCESSED',
    'affiliate_entries', inserted_affiliate,
    'company_entries', inserted_company,
    'attribution_type', attribution.attribution_type,
    'base_amount', base_amount
  );
end;
$$;

revoke all on function public.generate_affiliate_commissions(uuid) from public, anon, authenticated;
grant execute on function public.generate_affiliate_commissions(uuid) to service_role;

comment on function public.generate_affiliate_commissions(uuid) is
  'Idempotently generates direct/network commissions or the exclusive 15% + 5% remarketing split for a paid order.';
