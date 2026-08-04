create type public.order_status as enum (
  'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  checkout_draft_id uuid not null references public.checkout_drafts(id) on delete restrict,
  payment_attempt_id uuid not null unique references public.payment_attempts(id) on delete restrict,
  status public.order_status not null default 'PAID',
  currency text not null default 'BRL' check (currency = 'BRL'),
  payment_method public.checkout_payment_method not null,
  installments smallint not null check (installments between 1 and 10),
  subtotal_cents integer not null check (subtotal_cents > 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents > 0),
  recipient_name text not null,
  recipient_phone text not null,
  postal_code text not null,
  street text not null,
  address_number text not null,
  address_complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_totals_consistent check (
    total_cents = subtotal_cents - discount_cents + shipping_cents
    and discount_cents <= subtotal_cents
  )
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at);
create index orders_checkout_draft_idx on public.orders (checkout_draft_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  product_sku text not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity smallint not null check (quantity > 0),
  line_total_cents integer not null check (line_total_cents > 0),
  created_at timestamptz not null default now(),
  constraint order_items_product_once unique (order_id, product_id),
  constraint order_items_total_consistent check (line_total_cents = unit_price_cents * quantity)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  source text not null check (source in ('PAYMENT', 'ADMIN', 'SYSTEM', 'CUSTOMER')),
  correlation_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index order_status_history_order_created_idx
  on public.order_status_history (order_id, created_at);

create function public.set_orders_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_orders_updated_at();

alter table public.orders enable row level security;
alter table public.orders force row level security;
alter table public.order_items enable row level security;
alter table public.order_items force row level security;
alter table public.order_status_history enable row level security;
alter table public.order_status_history force row level security;

create policy orders_select_own on public.orders for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy order_items_select_own on public.order_items for select to authenticated
using (order_id in (
  select o.id from public.orders as o where o.user_id = (select auth.uid())
));

create policy order_status_history_select_own on public.order_status_history for select to authenticated
using (order_id in (
  select o.id from public.orders as o where o.user_id = (select auth.uid())
));

revoke all on public.orders from public, anon, authenticated;
revoke all on public.order_items from public, anon, authenticated;
revoke all on public.order_status_history from public, anon, authenticated;
revoke execute on function public.set_orders_updated_at() from public, anon, authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.order_status_history to authenticated;

comment on table public.orders is 'Immutable commercial and delivery snapshot created after confirmed payment.';
comment on table public.order_items is 'Immutable product, SKU, quantity, and price snapshots for each order.';
comment on table public.order_status_history is 'Append-only audit history for every order status transition.';
