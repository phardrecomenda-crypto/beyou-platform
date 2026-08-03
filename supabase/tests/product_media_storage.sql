begin;
select results_eq($$ select count(*)::bigint from storage.buckets where id = 'product-media' and public and file_size_limit = 5242880 $$, array[1::bigint], 'product media bucket is configured');
select results_eq($$ select count(*)::bigint from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '%product media%' $$, array[3::bigint], 'product media has three write policies');
rollback;
