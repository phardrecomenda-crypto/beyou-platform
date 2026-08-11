begin;

alter table public.products
  add column if not exists slug text,
  add column if not exists sku text,
  add column if not exists short_description text,
  add column if not exists image_url text,
  add column if not exists price_cents integer,
  add column if not exists compare_at_price_cents integer,
  add column if not exists status text,
  add column if not exists featured boolean;

update public.products
set
  slug = case id
    when 'fit' then 'befit'
    when 'fiber' then 'befiber'
    when 'calm' then 'becalm'
    when 'box' then 'kit-essencial-beyou'
    else lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
  end,
  sku = case id
    when 'fit' then 'BEYOU-BEFIT'
    when 'fiber' then 'BEYOU-BEFIBER'
    when 'calm' then 'BEYOU-BECALM'
    when 'box' then 'BEYOU-BOX'
    else 'BEYOU-' || upper(id)
  end,
  short_description = coalesce(nullif(trim(description), ''), name),
  price_cents = round(price * 100)::integer,
  compare_at_price_cents = case
    when old_price is null then null
    else round(old_price * 100)::integer
  end,
  stock_quantity = case
    when availability in ('available', 'preorder')
      then greatest(coalesce(stock_quantity, 0), 1)
    else coalesce(stock_quantity, 0)
  end,
  status = case when active then 'ACTIVE' else 'ARCHIVED' end,
  featured = (id = 'box')
where
  slug is null
  or sku is null
  or short_description is null
  or price_cents is null
  or status is null
  or featured is null
  or stock_quantity is null;

alter table public.products
  alter column slug set not null,
  alter column sku set not null,
  alter column short_description set not null,
  alter column price_cents set not null,
  alter column stock_quantity set not null,
  alter column status set not null,
  alter column featured set not null,
  alter column featured set default false;

create unique index if not exists products_slug_unique_idx
  on public.products (slug);
create unique index if not exists products_sku_unique_idx
  on public.products (sku);
create index if not exists products_published_catalog_idx
  on public.products (featured desc, created_at desc)
  where status = 'ACTIVE';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_status_check'
  ) then
    alter table public.products
      add constraint products_status_check
      check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED'));
  end if;
end
$$;

commit;
