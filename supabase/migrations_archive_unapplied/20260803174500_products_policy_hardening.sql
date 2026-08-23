drop policy if exists "Product media is publicly readable" on storage.objects;

drop policy if exists "Published products are readable" on public.products;
drop policy if exists "Administrators manage products" on public.products;

create policy "Anonymous users read published products" on public.products for select
to anon using (status = 'ACTIVE');

create policy "Authenticated users read permitted products" on public.products for select
to authenticated using (
  status = 'ACTIVE' or exists (
    select 1 from public.profiles
    where profiles.user_id = (select auth.uid())
      and profiles.role in ('SUPER_ADMIN','ADMIN')
      and profiles.status = 'ACTIVE'
  )
);

create policy "Administrators create products" on public.products for insert
to authenticated with check (
  exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('SUPER_ADMIN','ADMIN') and profiles.status = 'ACTIVE')
);

create policy "Administrators update products" on public.products for update
to authenticated using (
  exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('SUPER_ADMIN','ADMIN') and profiles.status = 'ACTIVE')
) with check (
  exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('SUPER_ADMIN','ADMIN') and profiles.status = 'ACTIVE')
);

create policy "Administrators delete products" on public.products for delete
to authenticated using (
  exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('SUPER_ADMIN','ADMIN') and profiles.status = 'ACTIVE')
);
