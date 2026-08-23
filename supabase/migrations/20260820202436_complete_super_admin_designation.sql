do $$
begin
  if (select count(*) from public.profiles where role::text = 'admin') = 1
     and (select count(*) from public.profiles where role::text = 'super_admin') = 0 then
    alter table public.profiles disable trigger protect_profile_role_before_update;
    update public.profiles set role = 'super_admin'::public.user_role, updated_at = now()
      where role::text = 'admin';
    alter table public.profiles enable trigger protect_profile_role_before_update;
  end if;
exception when others then
  alter table public.profiles enable trigger protect_profile_role_before_update;
  raise;
end
$$;
