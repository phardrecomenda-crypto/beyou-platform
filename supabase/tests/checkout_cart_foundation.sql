begin;

select has_type('public', 'cart_status', 'cart_status enum exists');
select has_table('public', 'carts', 'carts table exists');
select has_table('public', 'cart_items', 'cart_items table exists');
select has_view('public', 'cart_summaries', 'cart summary view exists');

select col_is_pk('public', 'carts', 'id', 'carts use UUID primary key');
select col_is_pk('public', 'cart_items', 'id', 'cart items use UUID primary key');

select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.carts'::regclass),
  true,
  'carts RLS is enabled'
);
select is(
  (select relforcerowsecurity from pg_catalog.pg_class where oid = 'public.carts'::regclass),
  true,
  'carts RLS is forced'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.cart_items'::regclass),
  true,
  'cart items RLS is enabled'
);
select is(
  (select relforcerowsecurity from pg_catalog.pg_class where oid = 'public.cart_items'::regclass),
  true,
  'cart items RLS is forced'
);

select results_eq(
  $$select count(*)::bigint from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'carts'$$,
  array[3::bigint],
  'carts have ownership policies'
);
select results_eq(
  $$select count(*)::bigint from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'cart_items'$$,
  array[3::bigint],
  'cart items have ownership policies'
);

select results_eq(
  $$select count(*)::bigint from pg_catalog.pg_indexes
    where schemaname = 'public' and indexname = 'cart_items_product_idx'$$,
  array[1::bigint],
  'product foreign key is indexed'
);

rollback;
