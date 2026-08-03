insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media', 'product-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Product media is publicly readable" on storage.objects for select
to anon, authenticated using (bucket_id = 'product-media');

create policy "Administrators upload product media" on storage.objects for insert
to authenticated with check (
  bucket_id = 'product-media' and exists (
    select 1 from public.profiles
    where profiles.user_id = (select auth.uid())
      and profiles.role in ('SUPER_ADMIN','ADMIN')
      and profiles.status = 'ACTIVE'
  )
);

create policy "Administrators update product media" on storage.objects for update
to authenticated using (
  bucket_id = 'product-media' and exists (
    select 1 from public.profiles
    where profiles.user_id = (select auth.uid())
      and profiles.role in ('SUPER_ADMIN','ADMIN')
      and profiles.status = 'ACTIVE'
  )
) with check (
  bucket_id = 'product-media' and exists (
    select 1 from public.profiles
    where profiles.user_id = (select auth.uid())
      and profiles.role in ('SUPER_ADMIN','ADMIN')
      and profiles.status = 'ACTIVE'
  )
);

create policy "Administrators delete product media" on storage.objects for delete
to authenticated using (
  bucket_id = 'product-media' and exists (
    select 1 from public.profiles
    where profiles.user_id = (select auth.uid())
      and profiles.role in ('SUPER_ADMIN','ADMIN')
      and profiles.status = 'ACTIVE'
  )
);
