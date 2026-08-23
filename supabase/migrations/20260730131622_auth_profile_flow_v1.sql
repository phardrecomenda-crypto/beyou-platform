create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_full_name text;
  v_phone text;
begin
  v_full_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  )), '');

  v_phone := nullif(trim(coalesce(
    new.phone,
    new.raw_user_meta_data->>'phone',
    ''
  )), '');

  insert into public.profiles (id, full_name, phone)
  values (new.id, v_full_name, v_phone)
  on conflict (id) do update
    set full_name = coalesce(public.profiles.full_name, excluded.full_name),
        phone = coalesce(public.profiles.phone, excluded.phone);

  insert into public.becoin_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.complete_my_profile(
  p_full_name text default null,
  p_phone text default null,
  p_birth_date date default null,
  p_city text default null,
  p_state text default null,
  p_avatar_url text default null
)
returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  update public.profiles
     set full_name = nullif(trim(p_full_name), ''),
         phone = nullif(trim(p_phone), ''),
         birth_date = p_birth_date,
         city = nullif(trim(p_city), ''),
         state = case
           when nullif(trim(p_state), '') is null then null
           else upper(left(trim(p_state), 2))
         end,
         avatar_url = nullif(trim(p_avatar_url), '')
   where id = auth.uid()
   returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Perfil não encontrado.';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.complete_my_profile(text,text,date,text,text,text) from public;
grant execute on function public.complete_my_profile(text,text,date,text,text,text) to authenticated;
