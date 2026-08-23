drop policy if exists "temp_product_assets_upload_v169" on storage.objects;
create policy "temp_product_assets_upload_v169"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'product-assets'
  and (storage.foldername(name))[1] = 'site-v169'
);
