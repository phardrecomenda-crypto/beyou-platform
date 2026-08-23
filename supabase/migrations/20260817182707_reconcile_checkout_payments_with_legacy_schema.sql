begin;

do $$ begin
  create type public.checkout_status as enum ('DRAFT', 'READY', 'PROCESSING', 'COMPLETED', 'EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.checkout_payment_method as enum ('PIX', 'CREDIT_CARD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_provider as enum ('ASAAS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_attempt_status as enum (
    'CREATED', 'PENDING', 'AUTHORIZED', 'CONFIRMED', 'RECEIVED',
    'FAILED', 'REFUNDED', 'CANCELLED', 'EXPIRED'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.checkout_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cart_id uuid not null unique references public.carts(id) on delete cascade,
  address_id uuid not null references public.customer_addresses(id) on delete restrict,
  status public.checkout_status not null default 'DRAFT',
  payment_method public.checkout_payment_method not null,
  installments smallint not null default 1 check (installments between 1 and 10),
  currency text not null default 'BRL' check (currency = 'BRL'),
  subtotal_cents integer not null check (subtotal_cents > 0),
  pix_discount_cents integer not null default 0 check (pix_discount_cents between 0 and subtotal_cents),
  shipping_cents integer check (shipping_cents is null or shipping_cents >= 0),
  total_cents integer check (total_cents is null or total_cents > 0),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkout_drafts_user_id_idx on public.checkout_drafts (user_id);
create index if not exists checkout_drafts_address_id_idx on public.checkout_drafts (address_id);
create index if not exists checkout_drafts_status_idx on public.checkout_drafts (status, updated_at desc);

create or replace function public.prepare_checkout_draft()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  cart_subtotal integer;
  cart_item_count integer;
  free_shipping boolean;
  allowed_installments integer;
begin
  if tg_op = 'UPDATE' and old.status = 'READY' and new.status = 'COMPLETED'
     and current_user in ('postgres', 'service_role') then
    new.updated_at := now();
    return new;
  end if;
  if authenticated_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if tg_op = 'UPDATE' and old.status not in ('DRAFT', 'READY') then
    raise exception using errcode = '23514', message = 'CHECKOUT_DRAFT_LOCKED';
  end if;

  select subtotal_cents, item_count, qualifies_for_free_shipping
    into cart_subtotal, cart_item_count, free_shipping
  from public.cart_summaries
  where cart_id = new.cart_id and user_id = authenticated_user_id
    and status = 'ACTIVE';

  if cart_subtotal is null or cart_item_count < 1 then
    raise exception using errcode = '23514', message = 'CHECKOUT_CART_INVALID';
  end if;
  if not exists (
    select 1 from public.customer_addresses
    where id = new.address_id and user_id = authenticated_user_id
  ) then
    raise exception using errcode = '23503', message = 'CHECKOUT_ADDRESS_INVALID';
  end if;

  new.user_id := authenticated_user_id;
  new.currency := 'BRL';
  new.subtotal_cents := cart_subtotal;
  if new.payment_method = 'PIX' then
    new.installments := 1;
    new.pix_discount_cents := round(cart_subtotal * 0.03)::integer;
  else
    new.pix_discount_cents := 0;
    allowed_installments := case when cart_subtotal <= 49999 then 3 when cart_subtotal <= 99999 then 6 else 10 end;
    if new.installments > allowed_installments then
      raise exception using errcode = '23514', message = 'CHECKOUT_INSTALLMENTS_INVALID';
    end if;
  end if;
  new.shipping_cents := case when free_shipping then 0 else null end;
  new.total_cents := case when free_shipping then cart_subtotal - new.pix_discount_cents else null end;
  new.status := case when free_shipping then 'READY'::public.checkout_status else 'DRAFT'::public.checkout_status end;
  new.expires_at := now() + interval '30 minutes';
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prepare_checkout_draft_before_write on public.checkout_drafts;
create trigger prepare_checkout_draft_before_write
before insert or update on public.checkout_drafts
for each row execute function public.prepare_checkout_draft();

alter table public.checkout_drafts enable row level security;
alter table public.checkout_drafts force row level security;
drop policy if exists checkout_drafts_select_own on public.checkout_drafts;
drop policy if exists checkout_drafts_insert_own on public.checkout_drafts;
drop policy if exists checkout_drafts_update_own on public.checkout_drafts;
drop policy if exists checkout_drafts_delete_own on public.checkout_drafts;
create policy checkout_drafts_select_own on public.checkout_drafts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy checkout_drafts_insert_own on public.checkout_drafts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy checkout_drafts_update_own on public.checkout_drafts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy checkout_drafts_delete_own on public.checkout_drafts for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.checkout_drafts from public, anon, authenticated;
grant select, delete on public.checkout_drafts to authenticated;
grant insert (cart_id, address_id, payment_method, installments) on public.checkout_drafts to authenticated;
grant update (address_id, payment_method, installments) on public.checkout_drafts to authenticated;
revoke all on function public.prepare_checkout_draft() from public, anon, authenticated;

create or replace function public.is_valid_cpf(value text)
returns boolean language sql immutable strict set search_path = ''
as $$
  with digits as (select regexp_replace(value, '[^0-9]', '', 'g') as cpf),
  first_digit as (
    select cpf, (((select sum(substr(cpf, position, 1)::integer * (11 - position))
      from generate_series(1, 9) as position) * 10 % 11) % 10) as d1 from digits
  ),
  second_digit as (
    select cpf, d1, (((select sum(substr(cpf, position, 1)::integer * (12 - position))
      from generate_series(1, 10) as position) * 10 % 11) % 10) as d2 from first_digit
  )
  select length(cpf) = 11 and cpf !~ '^([0-9])\1{10}$'
    and substr(cpf, 10, 1)::integer = d1
    and substr(cpf, 11, 1)::integer = d2
  from second_digit
$$;

create table if not exists public.billing_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  cpf text not null unique check (public.is_valid_cpf(cpf)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asaas_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_draft_id uuid not null references public.checkout_drafts(id) on delete restrict,
  provider public.payment_provider not null default 'ASAAS',
  provider_payment_id text unique,
  idempotency_key uuid not null unique,
  status public.payment_attempt_status not null default 'CREATED',
  payment_method public.checkout_payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  installments smallint not null check (installments between 1 and 10),
  pix_copy_paste text,
  pix_encoded_image text,
  pix_expires_at timestamptz,
  failure_code text,
  provider_status text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_attempts_user_id_idx on public.payment_attempts (user_id);
create index if not exists payment_attempts_checkout_draft_id_idx on public.payment_attempts (checkout_draft_id);
create index if not exists payment_attempts_status_idx on public.payment_attempts (status, updated_at desc);

create table if not exists public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  provider_payment_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  attempts integer not null default 0 check (attempts >= 0)
);
create index if not exists asaas_webhook_events_provider_payment_id_idx on public.asaas_webhook_events (provider_payment_id);
create index if not exists asaas_webhook_events_unprocessed_idx on public.asaas_webhook_events (received_at) where processed_at is null;

create or replace function public.prepare_billing_profile()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  new.user_id := (select auth.uid());
  new.cpf := regexp_replace(new.cpf, '[^0-9]', '', 'g');
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists prepare_billing_profile_before_write on public.billing_profiles;
create trigger prepare_billing_profile_before_write before insert or update on public.billing_profiles
for each row execute function public.prepare_billing_profile();

alter table public.billing_profiles enable row level security;
alter table public.billing_profiles force row level security;
alter table public.asaas_customers enable row level security;
alter table public.asaas_customers force row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_attempts force row level security;
alter table public.asaas_webhook_events enable row level security;
alter table public.asaas_webhook_events force row level security;

drop policy if exists billing_profiles_select_own on public.billing_profiles;
drop policy if exists billing_profiles_insert_own on public.billing_profiles;
drop policy if exists billing_profiles_update_own on public.billing_profiles;
drop policy if exists payment_attempts_select_own on public.payment_attempts;
create policy billing_profiles_select_own on public.billing_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy billing_profiles_insert_own on public.billing_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy billing_profiles_update_own on public.billing_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy payment_attempts_select_own on public.payment_attempts for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.billing_profiles, public.asaas_customers, public.payment_attempts, public.asaas_webhook_events from public, anon, authenticated;
grant select on public.billing_profiles to authenticated;
grant insert (cpf), update (cpf) on public.billing_profiles to authenticated;
grant select (id, checkout_draft_id, provider, provider_payment_id, status, payment_method,
  amount_cents, installments, pix_copy_paste, pix_encoded_image, pix_expires_at,
  failure_code, provider_status, confirmed_at, created_at, updated_at)
  on public.payment_attempts to authenticated;
revoke all on function public.prepare_billing_profile() from public, anon, authenticated;
revoke all on function public.is_valid_cpf(text) from public, anon;
grant execute on function public.is_valid_cpf(text) to authenticated, service_role;

alter table public.orders
  add column if not exists checkout_draft_id uuid references public.checkout_drafts(id) on delete restrict,
  add column if not exists payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  add column if not exists currency text default 'BRL',
  add column if not exists installments smallint default 1,
  add column if not exists subtotal_cents integer,
  add column if not exists discount_cents integer,
  add column if not exists shipping_cents integer,
  add column if not exists total_cents integer,
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text,
  add column if not exists postal_code text,
  add column if not exists street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists shipping_carrier text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

update public.orders set
  currency = coalesce(currency, 'BRL'), installments = coalesce(installments, 1),
  subtotal_cents = coalesce(subtotal_cents, round(subtotal * 100)::integer),
  discount_cents = coalesce(discount_cents, round(discount * 100)::integer),
  shipping_cents = coalesce(shipping_cents, round(shipping * 100)::integer),
  total_cents = coalesce(total_cents, round(total * 100)::integer),
  recipient_name = coalesce(recipient_name, shipping_address->>'recipient_name', shipping_address->>'name', 'Cliente'),
  recipient_phone = coalesce(recipient_phone, shipping_address->>'phone', ''),
  postal_code = coalesce(postal_code, shipping_address->>'postal_code', shipping_address->>'zip_code', ''),
  street = coalesce(street, shipping_address->>'street', ''),
  address_number = coalesce(address_number, shipping_address->>'number', ''),
  address_complement = coalesce(address_complement, shipping_address->>'complement'),
  neighborhood = coalesce(neighborhood, shipping_address->>'neighborhood', shipping_address->>'province', ''),
  city = coalesce(city, shipping_address->>'city', ''), state = coalesce(state, shipping_address->>'state', ''),
  shipping_carrier = coalesce(shipping_carrier, carrier);

create unique index if not exists orders_payment_attempt_unique_idx on public.orders (payment_attempt_id) where payment_attempt_id is not null;
create index if not exists orders_checkout_draft_idx on public.orders (checkout_draft_id) where checkout_draft_id is not null;

alter table public.order_items
  add column if not exists product_sku text,
  add column if not exists unit_price_cents integer,
  add column if not exists line_total_cents integer;
update public.order_items oi set
  product_sku = coalesce(oi.product_sku, p.sku, oi.product_id),
  unit_price_cents = coalesce(oi.unit_price_cents, round(oi.unit_price * 100)::integer),
  line_total_cents = coalesce(oi.line_total_cents, round(oi.line_total * 100)::integer)
from public.products p where p.id = oi.product_id;

alter table public.order_status_history
  add column if not exists from_status public.order_status,
  add column if not exists to_status public.order_status,
  add column if not exists source text,
  add column if not exists correlation_id text,
  add column if not exists metadata jsonb default '{}'::jsonb;
update public.order_status_history set to_status = coalesce(to_status, status), source = coalesce(source, 'SYSTEM'), metadata = coalesce(metadata, '{}'::jsonb);

create or replace function public.create_order_from_confirmed_payment(
  selected_provider_payment_id text,
  selected_correlation_id text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  selected_attempt public.payment_attempts%rowtype;
  selected_draft public.checkout_drafts%rowtype;
  selected_address public.customer_addresses%rowtype;
  selected_profile public.profiles%rowtype;
  existing_order_id uuid;
  created_order_id uuid;
begin
  select * into selected_attempt from public.payment_attempts
  where provider_payment_id = selected_provider_payment_id and status in ('CONFIRMED', 'RECEIVED') for update;
  if not found then return null; end if;
  select id into existing_order_id from public.orders where payment_attempt_id = selected_attempt.id;
  if existing_order_id is not null then return existing_order_id; end if;
  select * into strict selected_draft from public.checkout_drafts where id = selected_attempt.checkout_draft_id and user_id = selected_attempt.user_id;
  select * into strict selected_address from public.customer_addresses where id = selected_draft.address_id and user_id = selected_attempt.user_id;
  select * into selected_profile from public.profiles where id = selected_attempt.user_id;
  if selected_draft.status <> 'READY' or selected_draft.total_cents is null or selected_draft.total_cents <> selected_attempt.amount_cents then
    raise exception using errcode = '23514', message = 'ORDER_PAYMENT_CONTEXT_INVALID';
  end if;

  insert into public.orders (
    user_id, status, subtotal, discount, shipping, total, payment_method, shipping_address, metadata,
    asaas_payment_id, paid_at, checkout_draft_id, payment_attempt_id, currency, installments,
    subtotal_cents, discount_cents, shipping_cents, total_cents, recipient_name, recipient_phone,
    postal_code, street, address_number, address_complement, neighborhood, city, state
  ) values (
    selected_attempt.user_id, 'paid', selected_draft.subtotal_cents / 100.0, selected_draft.pix_discount_cents / 100.0,
    selected_draft.shipping_cents / 100.0, selected_draft.total_cents / 100.0, selected_attempt.payment_method::text,
    jsonb_build_object('recipient_name', coalesce(selected_profile.full_name, 'Cliente'), 'phone', coalesce(selected_profile.phone, ''),
      'postal_code', selected_address.postal_code, 'street', selected_address.street, 'number', selected_address.address_number,
      'complement', selected_address.complement, 'neighborhood', selected_address.province, 'city', selected_address.city, 'state', selected_address.state),
    jsonb_build_object('source', 'ASAAS'), selected_attempt.provider_payment_id, selected_attempt.confirmed_at,
    selected_draft.id, selected_attempt.id, selected_draft.currency, selected_attempt.installments,
    selected_draft.subtotal_cents, selected_draft.pix_discount_cents, selected_draft.shipping_cents, selected_draft.total_cents,
    coalesce(selected_profile.full_name, 'Cliente'), coalesce(selected_profile.phone, ''), selected_address.postal_code,
    selected_address.street, selected_address.address_number, selected_address.complement, selected_address.province,
    selected_address.city, selected_address.state
  ) returning id into created_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, quantity, item_type, unit_price, discount, line_total,
    product_sku, unit_price_cents, line_total_cents
  ) select created_order_id, item.product_id, item.product_name, item.quantity, 'product', item.unit_price_cents / 100.0,
    0, item.line_total_cents / 100.0, item.product_sku, item.unit_price_cents, item.line_total_cents
  from public.cart_items item where item.cart_id = selected_draft.cart_id;
  if not found then raise exception using errcode = '23514', message = 'ORDER_ITEMS_REQUIRED'; end if;

  insert into public.order_status_history (order_id, status, from_status, to_status, source, correlation_id)
  values (created_order_id, 'paid', null, 'paid', 'PAYMENT', selected_correlation_id);
  update public.checkout_drafts set status = 'COMPLETED' where id = selected_draft.id;
  update public.carts set status = 'CONVERTED' where id = selected_draft.cart_id and status = 'ACTIVE';
  return created_order_id;
exception when unique_violation then
  select id into existing_order_id from public.orders where payment_attempt_id = selected_attempt.id;
  return existing_order_id;
end;
$$;

create or replace function public.update_order_fulfillment(
  p_order_id uuid, p_next_status text, p_actor_id uuid,
  p_tracking_code text default null, p_shipping_carrier text default null
) returns public.orders language plpgsql security definer set search_path = ''
as $$
declare
  selected_order public.orders;
  updated_order public.orders;
  normalized_next text := lower(p_next_status);
  normalized_tracking text := nullif(btrim(p_tracking_code), '');
  normalized_carrier text := nullif(btrim(p_shipping_carrier), '');
begin
  select * into selected_order from public.orders where id = p_order_id for update;
  if selected_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_actor_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  if not ((selected_order.status = 'paid' and normalized_next in ('processing','cancelled','refunded'))
    or (selected_order.status = 'processing' and normalized_next in ('shipped','cancelled','refunded'))
    or (selected_order.status = 'shipped' and normalized_next in ('delivered','refunded'))
    or (selected_order.status = 'delivered' and normalized_next = 'refunded')) then
    raise exception 'ORDER_TRANSITION_INVALID';
  end if;
  if normalized_next = 'shipped' and (normalized_tracking is null or normalized_carrier is null) then raise exception 'TRACKING_REQUIRED'; end if;
  update public.orders set status = normalized_next::public.order_status,
    tracking_code = case when normalized_next = 'shipped' then normalized_tracking else tracking_code end,
    carrier = case when normalized_next = 'shipped' then normalized_carrier else carrier end,
    shipping_carrier = case when normalized_next = 'shipped' then normalized_carrier else shipping_carrier end,
    shipped_at = case when normalized_next = 'shipped' then now() else shipped_at end,
    delivered_at = case when normalized_next = 'delivered' then now() else delivered_at end
  where id = p_order_id returning * into updated_order;
  insert into public.order_status_history(order_id, status, from_status, to_status, source, correlation_id, metadata)
  values (p_order_id, normalized_next::public.order_status, selected_order.status, normalized_next::public.order_status,
    'ADMIN', p_actor_id::text, case when normalized_next = 'shipped' then jsonb_build_object('tracking_code', normalized_tracking, 'shipping_carrier', normalized_carrier) else '{}'::jsonb end);
  return updated_order;
end;
$$;

revoke all on function public.create_order_from_confirmed_payment(text, text) from public, anon, authenticated;
grant execute on function public.create_order_from_confirmed_payment(text, text) to service_role;
revoke all on function public.update_order_fulfillment(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_order_fulfillment(uuid, text, uuid, text, text) to service_role;

grant select, insert, update, delete on public.checkout_drafts to service_role;
grant select, insert, update, delete on public.billing_profiles, public.asaas_customers, public.payment_attempts, public.asaas_webhook_events to service_role;

commit;
