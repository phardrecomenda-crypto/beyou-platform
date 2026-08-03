-- BEYOU Platform v1 — clean authentication/profile foundation.

begin;

create type public.user_role as enum (
  'SUPER_ADMIN', 'ADMIN', 'FINANCEIRO', 'GESTOR',
  'RECRUTADOR', 'AFILIADO', 'CLIENTE', 'SUPORTE'
);

create type public.profile_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 150),
  email text not null check (char_length(btrim(email)) between 3 and 320),
  phone text,
  avatar_url text,
  role public.user_role not null default 'CLIENTE',
  status public.profile_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_status_idx on public.profiles (status);

comment on table public.profiles is 'BEYOU application profile linked one-to-one with Supabase Auth.';
comment on column public.profiles.role is 'Authorization role. Clients cannot change this column.';
comment on column public.profiles.status is 'Account application status. Clients cannot change this column.';

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (name, phone, avatar_url) on table public.profiles to authenticated;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  if profile_name is null or char_length(profile_name) < 3 then
    raise exception 'full_name is required and must contain at least 3 characters';
  end if;

  insert into public.profiles (user_id, name, email)
  values (new.id, profile_name, new.email);
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create function private.set_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_profile_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_profile_updated_at();

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

commit;
