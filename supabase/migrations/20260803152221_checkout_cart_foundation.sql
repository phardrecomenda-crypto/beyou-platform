create type public.cart_status as enum ('ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED');

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.cart_status not null default 'ACTIVE',
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint carts_currency_brl check (currency = 'BRL'),
  constraint carts_expiration_after_creation check (expires_at > created_at)
);

create unique index carts_one_active_per_user_idx on public.carts (user_id) where status = 'ACTIVE';
create index carts_user_status_idx on public.carts (user_id, status, updated_at desc);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  product_sku text not null,
  unit_price_cents integer not null,
  quantity smallint not null default 1,
  line_total_cents integer generated always as (unit_price_cents * quantity) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_product_name_not_blank check (btrim(product_name) <> ''),
  constraint cart_items_product_sku_not_blank check (btrim(product_sku) <> ''),
  constraint cart_items_unit_price_positive check (unit_price_cents > 0),
  constraint cart_items_single_unit check (quantity = 1),
  constraint cart_items_product_once unique (cart_id, product_id)
);

create index cart_items_cart_idx on public.cart_items (cart_id, created_at);

create function public.set_carts_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger carts_set_updated_at before update on public.carts
for each row execute function public.set_carts_updated_at();

create function public.set_cart_item_snapshot()
returns trigger language plpgsql set search_path = ''
as $$
declare selected_product record;
begin
  select p.name, p.sku, p.price_cents into selected_product
  from public.products as p
  where p.id = new.product_id and p.status = 'ACTIVE'
    and p.stock_quantity > 0 and p.price_cents is not null;
  if not found then
    raise exception using errcode = 'P0001', message = 'PRODUCT_UNAVAILABLE';
  end if;
  new.product_name = selected_product.name;
  new.product_sku = selected_product.sku;
  new.unit_price_cents = selected_product.price_cents;
  new.quantity = 1;
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_carts_updated_at() from public, anon, authenticated;
revoke execute on function public.set_cart_item_snapshot() from public, anon, authenticated;

create trigger cart_items_set_snapshot before insert on public.cart_items
for each row execute function public.set_cart_item_snapshot();

create function public.touch_cart_from_item()
returns trigger language plpgsql set search_path = ''
as $$
begin
  update public.carts set updated_at = now()
  where id = coalesce(new.cart_id, old.cart_id);
  return coalesce(new, old);
end;
$$;

revoke execute on function public.touch_cart_from_item() from public, anon, authenticated;

create trigger cart_items_touch_cart after insert or delete on public.cart_items
for each row execute function public.touch_cart_from_item();

alter table public.carts enable row level security;
alter table public.carts force row level security;
alter table public.cart_items enable row level security;
alter table public.cart_items force row level security;

create policy "Customers read own carts" on public.carts for select
to authenticated using ((select auth.uid()) = user_id);

create policy "Customers create own active cart" on public.carts for insert
to authenticated with check ((select auth.uid()) = user_id and status = 'ACTIVE');

create policy "Customers delete own active cart" on public.carts for delete
to authenticated using ((select auth.uid()) = user_id and status = 'ACTIVE');

create policy "Customers read own cart items" on public.cart_items for select
to authenticated using (
  cart_id in (select c.id from public.carts as c where c.user_id = (select auth.uid()))
);

create policy "Customers add items to own active cart" on public.cart_items for insert
to authenticated with check (
  quantity = 1 and cart_id in (
    select c.id from public.carts as c
    where c.user_id = (select auth.uid()) and c.status = 'ACTIVE' and c.expires_at > now()
  )
);

create policy "Customers remove items from own active cart" on public.cart_items for delete
to authenticated using (
  cart_id in (
    select c.id from public.carts as c
    where c.user_id = (select auth.uid()) and c.status = 'ACTIVE'
  )
);

create view public.cart_summaries with (security_invoker = true) as
select c.id as cart_id, c.user_id, c.status, c.currency,
  count(ci.id)::integer as item_count,
  coalesce(sum(ci.line_total_cents), 0)::integer as subtotal_cents,
  greatest(60000 - coalesce(sum(ci.line_total_cents), 0), 0)::integer as free_shipping_remaining_cents,
  (coalesce(sum(ci.line_total_cents), 0) >= 60000) as qualifies_for_free_shipping,
  c.expires_at, c.created_at, c.updated_at
from public.carts as c
left join public.cart_items as ci on ci.cart_id = c.id
group by c.id, c.user_id, c.status, c.currency, c.expires_at, c.created_at, c.updated_at;

revoke all on table public.carts from anon, authenticated;
revoke all on table public.cart_items from anon, authenticated;
revoke all on table public.cart_summaries from anon, authenticated;

grant select on table public.carts to authenticated;
grant insert (user_id) on table public.carts to authenticated;
grant delete on table public.carts to authenticated;
grant select on table public.cart_items to authenticated;
grant insert (cart_id, product_id, quantity) on table public.cart_items to authenticated;
grant delete on table public.cart_items to authenticated;
grant select on table public.cart_summaries to authenticated;

comment on table public.carts is 'Carrinhos persistentes da Fase 05 Checkout.';
comment on table public.cart_items is 'Itens com preço e identificação do produto preservados no momento da inclusão.';
comment on view public.cart_summaries is 'Resumo seguro do carrinho e progresso para frete grátis em R$ 600,00.';
