begin;
select has_table('public', 'products', 'products exists');
select col_is_pk('public', 'products', 'id', 'products uses UUID primary key');
select is((select relrowsecurity from pg_class where oid='public.products'::regclass), true, 'RLS enabled');
select is((select relforcerowsecurity from pg_class where oid='public.products'::regclass), true, 'RLS forced');
select results_eq($$ select count(*)::bigint from public.products where status = 'ACTIVE' $$, array[1::bigint], 'only approved kit is active');
rollback;
