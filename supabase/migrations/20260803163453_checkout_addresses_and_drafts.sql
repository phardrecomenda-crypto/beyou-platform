create type public.checkout_status as enum ('DRAFT', 'READY', 'PROCESSING', 'COMPLETED', 'EXPIRED');
create type public.checkout_payment_method as enum ('PIX', 'CREDIT_CARD');

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Principal' check (char_length(btrim(label)) between 1 and 40),
  recipient_name text not null check (char_length(btrim(recipient_name)) between 2 and 120),
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  postal_code text not null check (postal_code ~ '^[0-9]{8}$'),
  street text not null check (char_length(btrim(street)) between 2 and 160),
  number text not null check (char_length(btrim(number)) between 1 and 20),
  complement text check (complement is null or char_length(btrim(complement)) between 1 and 100),
  neighborhood text not null check (char_length(btrim(neighborhood)) between 2 and 100),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  state text not null check (state ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_addresses_user_id_idx on public.customer_addresses (user_id);
create unique index customer_addresses_one_default_per_user_idx on public.customer_addresses (user_id) where is_default;

create table public.checkout_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cart_id uuid not null unique references public.carts(id) on delete cascade,
  address_id uuid not null references public.customer_addresses(id) on delete restrict,
  status public.checkout_status not null default 'DRAFT',
  payment_method public.checkout_payment_method not null,
  installments smallint not null default 1 check (installments between 1 and 10),
  currency text not null default 'BRL' check (currency = 'BRL'),
  subtotal_cents integer not null check (subtotal_cents > 0),
  pix_discount_cents integer not null default 0 check (pix_discount_cents >= 0 and pix_discount_cents <= subtotal_cents),
  shipping_cents integer check (shipping_cents is null or shipping_cents >= 0),
  total_cents integer check (total_cents is null or total_cents >= 0),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checkout_drafts_user_id_idx on public.checkout_drafts (user_id);
create index checkout_drafts_address_id_idx on public.checkout_drafts (address_id);
create index checkout_drafts_status_idx on public.checkout_drafts (status);

create or replace function public.prepare_customer_address()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  new.user_id := (select auth.uid());
  new.label := btrim(new.label);
  new.recipient_name := btrim(new.recipient_name);
  new.street := btrim(new.street);
  new.number := btrim(new.number);
  new.complement := nullif(btrim(new.complement), '');
  new.neighborhood := btrim(new.neighborhood);
  new.city := btrim(new.city);
  new.state := upper(btrim(new.state));
  new.updated_at := now();
  return new;
end;
$$;
create trigger prepare_customer_address_before_write before insert or update on public.customer_addresses
for each row execute function public.prepare_customer_address();

create or replace function public.prepare_checkout_draft()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  authenticated_user_id uuid;
  cart_subtotal integer;
  cart_item_count integer;
  free_shipping boolean;
  allowed_installments integer;
begin
  authenticated_user_id := (select auth.uid());
  if authenticated_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if tg_op = 'UPDATE' and old.status not in ('DRAFT', 'READY') then
    raise exception using errcode = '23514', message = 'CHECKOUT_DRAFT_LOCKED';
  end if;

  select summary.subtotal_cents, summary.item_count, summary.qualifies_for_free_shipping
  into cart_subtotal, cart_item_count, free_shipping
  from public.cart_summaries as summary
  where summary.cart_id = new.cart_id
    and summary.user_id = authenticated_user_id
    and summary.status::text = 'ACTIVE';

  if cart_subtotal is null or cart_item_count < 1 then
    raise exception using errcode = '23514', message = 'CHECKOUT_CART_INVALID';
  end if;
  if not exists (
    select 1 from public.customer_addresses as address
    where address.id = new.address_id and address.user_id = authenticated_user_id
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
      raise exception using errcode = '23514', message = 'CHECKOUT_INSTALLMENTS_INVALID',
        detail = format('Maximum installments: %s', allowed_installments);
    end if;
  end if;
  new.shipping_cents := case when free_shipping then 0 else null end;
  new.total_cents := case when new.shipping_cents is null then null
    else cart_subtotal - new.pix_discount_cents + new.shipping_cents end;
  new.status := case when new.shipping_cents is null then 'DRAFT'::public.checkout_status
    else 'READY'::public.checkout_status end;
  new.updated_at := now();
  return new;
end;
$$;
create trigger prepare_checkout_draft_before_write before insert or update on public.checkout_drafts
for each row execute function public.prepare_checkout_draft();

alter table public.customer_addresses enable row level security;
alter table public.customer_addresses force row level security;
alter table public.checkout_drafts enable row level security;
alter table public.checkout_drafts force row level security;

create policy customer_addresses_select_own on public.customer_addresses for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy customer_addresses_insert_own on public.customer_addresses for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy customer_addresses_update_own on public.customer_addresses for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy customer_addresses_delete_own on public.customer_addresses for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy checkout_drafts_select_own on public.checkout_drafts for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy checkout_drafts_insert_own on public.checkout_drafts for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy checkout_drafts_update_own on public.checkout_drafts for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy checkout_drafts_delete_own on public.checkout_drafts for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on public.customer_addresses from public, anon, authenticated;
grant select, delete on public.customer_addresses to authenticated;
grant insert (label, recipient_name, phone, postal_code, street, number, complement, neighborhood, city, state, is_default)
on public.customer_addresses to authenticated;
grant update (label, recipient_name, phone, postal_code, street, number, complement, neighborhood, city, state, is_default)
on public.customer_addresses to authenticated;

revoke all on public.checkout_drafts from public, anon, authenticated;
grant select, delete on public.checkout_drafts to authenticated;
grant insert (cart_id, address_id, payment_method, installments) on public.checkout_drafts to authenticated;
grant update (address_id, payment_method, installments) on public.checkout_drafts to authenticated;
revoke execute on function public.prepare_customer_address() from public, anon, authenticated;
revoke execute on function public.prepare_checkout_draft() from public, anon, authenticated;

comment on table public.customer_addresses is 'Customer-owned Brazilian delivery addresses protected by RLS and column privileges.';
comment on table public.checkout_drafts is 'Server-calculated checkout snapshot with PIX discount, installment limits, and free-shipping eligibility.';
