do $$
begin
  if (select count(*) from public.profiles where role::text = 'admin') = 1
     and (select count(*) from public.profiles where role::text = 'super_admin') = 0 then
    update public.profiles set role = 'super_admin'::public.user_role, updated_at = now()
    where role::text = 'admin';
  end if;
end
$$;
