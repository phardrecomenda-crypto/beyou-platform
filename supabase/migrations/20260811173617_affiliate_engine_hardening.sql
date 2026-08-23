-- SPRINT 08 — Affiliate Engine hardening

alter table public.affiliate_links
  add constraint affiliate_links_eligible_affiliate_fkey
  foreign key (affiliate_user_id) references public.affiliate_profiles(user_id) on delete restrict;

alter table public.remarketing_service_records
  add constraint remarketing_service_eligible_affiliate_fkey
  foreign key (affiliate_user_id) references public.affiliate_profiles(user_id) on delete restrict;

alter table public.sale_attributions
  add constraint sale_attributions_eligible_affiliate_fkey
  foreign key (affiliate_user_id) references public.affiliate_profiles(user_id) on delete restrict;

alter table public.commission_ledger
  add constraint commission_ledger_eligible_beneficiary_fkey
  foreign key (affiliate_user_id) references public.affiliate_profiles(user_id) on delete restrict;

create or replace function private.validate_sale_attribution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  service_record public.remarketing_service_records%rowtype;
begin
  if new.attribution_type = 'DIRECT' then
    if new.remarketing_service_record_id is not null then
      raise exception using errcode = '23514', message = 'Direct attribution cannot use a remarketing service record.';
    end if;
    return new;
  end if;

  select *
    into service_record
    from public.remarketing_service_records
   where id = new.remarketing_service_record_id;

  if not found then
    raise exception using errcode = '23514', message = 'Remarketing attribution requires a service record.';
  end if;

  if service_record.affiliate_user_id <> new.affiliate_user_id then
    raise exception using errcode = '23514', message = 'Remarketing service record belongs to another affiliate.';
  end if;

  if service_record.status <> 'WON'
     or service_record.first_contact_at is null
     or service_record.first_contact_at > service_record.sla_due_at
     or service_record.closed_at is null then
    raise exception using errcode = '23514', message = 'Remarketing attribution requires a won service record completed within SLA.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_sale_attribution() from public, anon, authenticated;

create trigger sale_attributions_validate_before_write
before insert or update on public.sale_attributions
for each row execute function private.validate_sale_attribution();

comment on function private.validate_sale_attribution() is
  'Enforces affiliate ownership and won/in-SLA service evidence for every remarketing attribution.';

