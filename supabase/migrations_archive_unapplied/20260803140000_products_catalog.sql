create type public.product_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sku text not null unique,
  name text not null,
  short_description text not null,
  description text,
  image_url text,
  price_cents integer,
  compare_at_price_cents integer,
  stock_quantity integer not null default 0,
  status public.product_status not null default 'DRAFT',
  featured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_sku_not_blank check (btrim(sku) <> ''),
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_price_nonnegative check (price_cents is null or price_cents >= 0),
  constraint products_compare_price_nonnegative check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  constraint products_compare_price_valid check (compare_at_price_cents is null or price_cents is null or compare_at_price_cents >= price_cents),
  constraint products_stock_nonnegative check (stock_quantity >= 0),
  constraint products_active_has_price check (status <> 'ACTIVE' or price_cents is not null)
);

create index products_catalog_idx on public.products (featured desc, created_at desc) where status = 'ACTIVE';

create function public.set_products_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger products_set_updated_at before update on public.products
for each row execute function public.set_products_updated_at();

alter table public.products enable row level security;
alter table public.products force row level security;

create policy "Published products are readable" on public.products for select
to anon, authenticated using (status = 'ACTIVE');

create policy "Administrators manage products" on public.products for all
to authenticated
using (exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('SUPER_ADMIN', 'ADMIN') and profiles.status = 'ACTIVE'))
with check (exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('SUPER_ADMIN', 'ADMIN') and profiles.status = 'ACTIVE'));

revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

insert into public.products (slug, sku, name, short_description, description, price_cents, stock_quantity, status, featured, metadata) values
('kit-essencial-beyou','BY-KIT-ESSENCIAL','Kit Essencial BEYOU','BeFit, BeFiber e BeCalm para sua rotina completa.','O kit oficial de lançamento reúne os três produtos da rotina BEYOU.',19990,0,'ACTIVE',true,'{"items":["BeFit","BeFiber","BeCalm"]}'::jsonb),
('befit','BY-BEFIT-60','BeFit','60 cápsulas para energia e rotina.',null,null,0,'DRAFT',false,'{"size":"60 cápsulas"}'::jsonb),
('befiber-morango','BY-BEFIBER-MOR-210','BeFiber Morango','210 g de fibras para sua rotina diária.',null,null,0,'DRAFT',false,'{"size":"210 g","flavor":"Morango"}'::jsonb),
('becalm','BY-BECALM-30','BeCalm','30 ml para sua pausa da noite.',null,null,0,'DRAFT',false,'{"size":"30 ml"}'::jsonb);
