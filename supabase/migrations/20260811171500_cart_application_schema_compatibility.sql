begin;

alter table public.carts
  add column if not exists currency text,
  add column if not exists expires_at timestamptz;

alter table public.cart_items
  add column if not exists product_name text,
  add column if not exists product_sku text,
  add column if not exists unit_price_cents integer;

alter table public.carts drop constraint if exists carts_status_check;

update public.carts
set
  status = upper(status),
  currency = coalesce(currency, 'BRL'),
  expires_at = coalesce(expires_at, created_at + interval '30 days');

alter table public.carts
  alter column status set default 'ACTIVE',
  alter column currency set default 'BRL',
  alter column currency set not null,
  alter column expires_at set default (now() + interval '30 days'),
  alter column expires_at set not null;

alter table public.carts
  add constraint carts_status_check
  check (status in ('ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED'));

update public.cart_items ci
set
  quantity = 1,
  product_name = p.name,
  product_sku = p.sku,
  unit_price_cents = round(ci.unit_price * 100)::integer
from public.products p
where p.id = ci.product_id;

alter table public.cart_items
  alter column product_name set not null,
  alter column product_sku set not null,
  alter column unit_price_cents set not null;

alter table public.cart_items
  add column if not exists line_total_cents integer
  generated always as (unit_price_cents * quantity) stored;

create or replace function public.set_cart_item_application_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  selected_product record;
begin
  select p.name, p.sku, p.price, p.price_cents
    into selected_product
  from public.products p
  where p.id = new.product_id
    and p.status = 'ACTIVE'
    and p.stock_quantity > 0
    and p.price_cents is not null;

  if not found then
    raise exception using errcode = 'P0001', message = 'PRODUCT_UNAVAILABLE';
  end if;

  new.product_name = selected_product.name;
  new.product_sku = selected_product.sku;
  new.unit_price_cents = selected_product.price_cents;
  new.unit_price = selected_product.price;
  new.quantity = 1;
  new.item_type = coalesce(new.item_type, 'product');
  new.discount_percent = coalesce(new.discount_percent, 0);
  new.metadata = coalesce(new.metadata, '{}'::jsonb);
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cart_items_set_application_snapshot on public.cart_items;
create trigger cart_items_set_application_snapshot
before insert on public.cart_items
for each row execute function public.set_cart_item_application_snapshot();

revoke all on function public.set_cart_item_application_snapshot() from public;
revoke execute on function public.set_cart_item_application_snapshot()
  from anon, authenticated;

create or replace view public.cart_summaries
with (security_invoker = true)
as
select
  c.id as cart_id,
  c.user_id,
  c.status,
  c.currency,
  count(ci.id)::integer as item_count,
  coalesce(sum(ci.line_total_cents), 0)::integer as subtotal_cents,
  greatest(60000 - coalesce(sum(ci.line_total_cents), 0), 0)::integer
    as free_shipping_remaining_cents,
  (coalesce(sum(ci.line_total_cents), 0) >= 60000)
    as qualifies_for_free_shipping,
  c.expires_at,
  c.created_at,
  c.updated_at
from public.carts c
left join public.cart_items ci on ci.cart_id = c.id
group by c.id, c.user_id, c.status, c.currency, c.expires_at, c.created_at, c.updated_at;

revoke all on table public.cart_summaries from anon;
grant select on table public.cart_summaries to authenticated;

commit;
