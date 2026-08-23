-- Customers may edit their own personal data, never identity or authorization fields.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, birth_date, city, state, avatar_url, cpf) on public.profiles to authenticated;

-- Honor the previously authorized promotion only when there is one legacy admin
-- and no super administrator has been designated yet.
do $$
begin
  if (select count(*) from public.profiles where role = 'admin'::public.user_role) = 1
     and (select count(*) from public.profiles where role = 'super_admin'::public.user_role) = 0 then
    update public.profiles
       set role = 'super_admin'::public.user_role,
           updated_at = now()
     where role = 'admin'::public.user_role;
  end if;
end
$$;

drop policy if exists products_admin_manage on public.products;
create policy products_admin_manage
on public.products for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin'::public.user_role, 'super_admin'::public.user_role)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin'::public.user_role, 'super_admin'::public.user_role)
  )
);

create or replace function public.review_affiliate_application(
  p_application_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_review_notes text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  selected_application public.affiliate_applications%rowtype;
  generated_code text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_reviewer_id
      and p.role in ('admin'::public.user_role, 'super_admin'::public.user_role)
  ) then raise exception using errcode = '42501', message = 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_DECISION';
  end if;
  select * into selected_application from public.affiliate_applications
   where id = p_application_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'APPLICATION_NOT_FOUND'; end if;
  if selected_application.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'APPLICATION_ALREADY_REVIEWED';
  end if;
  update public.affiliate_applications set status = p_decision, reviewed_by = p_reviewer_id,
    reviewed_at = now(), review_notes = nullif(btrim(p_review_notes), ''), updated_at = now()
    where id = p_application_id;
  if p_decision = 'rejected' then
    return jsonb_build_object('status', 'rejected', 'application_id', p_application_id);
  end if;
  generated_code := 'BY' || upper(substr(replace(selected_application.user_id::text, '-', ''), 1, 10));
  insert into public.affiliate_profiles (user_id, affiliate_code, focus, active)
  values (selected_application.user_id, generated_code, 'affiliate'::public.user_role, true)
  on conflict (user_id) do update set active = true, updated_at = now();
  return jsonb_build_object('status', 'approved', 'application_id', p_application_id,
    'affiliate_user_id', selected_application.user_id, 'affiliate_code', generated_code);
end;
$$;

create or replace function public.release_affiliate_commission(p_actor_id uuid, p_commission_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role in
    ('admin'::public.user_role,'super_admin'::public.user_role,'finance'::public.user_role))
  then raise exception 'ADMIN_REQUIRED'; end if;
  update public.commission_ledger set status='released',released_at=now()
   where id=p_commission_id and status in('calculated','pending');
  if not found then raise exception 'COMMISSION_NOT_PENDING'; end if;
end $$;

create or replace function public.process_affiliate_payout(
  p_actor_id uuid, p_request_id uuid, p_decision text, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v public.affiliate_payout_requests%rowtype;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role in
    ('admin'::public.user_role,'super_admin'::public.user_role,'finance'::public.user_role))
  then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v from public.affiliate_payout_requests where id=p_request_id for update;
  if v.id is null or v.status<>'REQUESTED' then raise exception 'PAYOUT_NOT_REQUESTED'; end if;
  if p_decision='PAID' then
    update public.affiliate_payout_requests set status='PAID',processed_at=now(),processed_by=p_actor_id where id=v.id;
    insert into public.affiliate_wallet_entries(affiliate_user_id,payout_request_id,entry_type,paid_delta,idempotency_key)
    values(v.affiliate_user_id,v.id,'PAYOUT_PAID',v.amount,'payout:'||v.id||':paid');
  elsif p_decision='REJECTED' then
    update public.affiliate_payout_requests set status='REJECTED',processed_at=now(),processed_by=p_actor_id,
      rejection_reason=nullif(trim(p_reason),'') where id=v.id;
    insert into public.affiliate_wallet_entries(affiliate_user_id,payout_request_id,entry_type,available_delta,idempotency_key)
    values(v.affiliate_user_id,v.id,'PAYOUT_RESTORED',v.amount,'payout:'||v.id||':restored');
  else raise exception 'INVALID_DECISION'; end if;
end $$;

create or replace function public.list_affiliate_payouts_for_admin(p_actor_id uuid)
returns table(id uuid,affiliate_user_id uuid,affiliate_name text,amount numeric,status text,pix_key_type text,
  pix_key text,pix_key_masked text,requested_at timestamptz,processed_at timestamptz,rejection_reason text)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where profiles.id=p_actor_id and profiles.role in
    ('admin'::public.user_role,'super_admin'::public.user_role,'finance'::public.user_role))
  then raise exception 'ADMIN_REQUIRED'; end if;
  return query select r.id,r.affiliate_user_id,coalesce(p.full_name,'Afiliado BEYOU'),r.amount,r.status,
    r.pix_key_type,extensions.pgp_sym_decrypt(decode(r.pix_key_encrypted,'base64'),current_setting('app.settings.jwt_secret',true))::text,
    r.pix_key_masked,r.requested_at,r.processed_at,r.rejection_reason
    from public.affiliate_payout_requests r join public.profiles p on p.id=r.affiliate_user_id
    order by case when r.status='REQUESTED' then 0 else 1 end,r.requested_at desc limit 200;
end $$;

create or replace function public.update_order_fulfillment(
  p_order_id uuid, p_next_status text, p_actor_id uuid,
  p_tracking_code text default null, p_shipping_carrier text default null
) returns public.orders language plpgsql security definer set search_path = '' as $$
declare
  selected_order public.orders; updated_order public.orders; actor_role public.user_role;
  normalized_next text := lower(p_next_status);
  normalized_tracking text := nullif(btrim(p_tracking_code), '');
  normalized_carrier text := nullif(btrim(p_shipping_carrier), '');
begin
  select role into actor_role from public.profiles where id=p_actor_id;
  if actor_role is null or actor_role not in ('admin'::public.user_role,'super_admin'::public.user_role,'support'::public.user_role)
    then raise exception 'ADMIN_REQUIRED'; end if;
  if actor_role='support'::public.user_role and normalized_next in ('cancelled','refunded')
    then raise exception 'ADMIN_REQUIRED'; end if;
  select * into selected_order from public.orders where id=p_order_id for update;
  if selected_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if not ((selected_order.status = 'paid' and normalized_next in ('processing','cancelled','refunded'))
    or (selected_order.status = 'processing' and normalized_next in ('shipped','cancelled','refunded'))
    or (selected_order.status = 'shipped' and normalized_next in ('delivered','refunded'))
    or (selected_order.status = 'delivered' and normalized_next = 'refunded'))
    then raise exception 'ORDER_TRANSITION_INVALID'; end if;
  if normalized_next = 'shipped' and (normalized_tracking is null or normalized_carrier is null)
    then raise exception 'TRACKING_REQUIRED'; end if;
  update public.orders set status=normalized_next::public.order_status,
    tracking_code=case when normalized_next='shipped' then normalized_tracking else tracking_code end,
    carrier=case when normalized_next='shipped' then normalized_carrier else carrier end,
    shipping_carrier=case when normalized_next='shipped' then normalized_carrier else shipping_carrier end,
    shipped_at=case when normalized_next='shipped' then now() else shipped_at end,
    delivered_at=case when normalized_next='delivered' then now() else delivered_at end
    where id=p_order_id returning * into updated_order;
  insert into public.order_status_history(order_id,status,from_status,to_status,source,correlation_id,metadata)
  values(p_order_id,normalized_next::public.order_status,selected_order.status,normalized_next::public.order_status,
    'ADMIN',p_actor_id::text,case when normalized_next='shipped' then
    jsonb_build_object('tracking_code',normalized_tracking,'shipping_carrier',normalized_carrier) else '{}'::jsonb end);
  return updated_order;
end $$;
