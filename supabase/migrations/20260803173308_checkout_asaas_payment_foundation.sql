create type public.payment_provider as enum ('ASAAS');
create type public.payment_attempt_status as enum (
  'CREATED', 'PENDING', 'AUTHORIZED', 'CONFIRMED', 'RECEIVED',
  'FAILED', 'REFUNDED', 'CANCELLED', 'EXPIRED'
);

create or replace function public.is_valid_cpf(value text)
returns boolean language sql immutable strict set search_path = ''
as $$
  with digits as (select regexp_replace(value, '[^0-9]', '', 'g') as cpf),
  checks as (
    select cpf,
      case when length(cpf) = 11 then
        (select (11 - (sum((substr(cpf, i, 1)::int) * (10 - i)) % 11)) % 10
         from generate_series(1, 9) as i)
      end as d1
    from digits
  )
  select length(cpf) = 11
    and cpf !~ '^([0-9])\1{10}$'
    and substr(cpf, 10, 1)::int = d1
    and substr(cpf, 11, 1)::int = (
      select (11 - (sum((substr(cpf, i, 1)::int) * (11 - i)) % 11)) % 10
      from generate_series(1, 10) as i
    )
  from checks
$$;

create table public.billing_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  cpf text not null unique check (public.is_valid_cpf(cpf)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.asaas_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider_customer_id text not null unique check (provider_customer_id ~ '^cus_'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_draft_id uuid not null references public.checkout_drafts(id) on delete restrict,
  provider public.payment_provider not null default 'ASAAS',
  provider_payment_id text unique check (provider_payment_id is null or provider_payment_id ~ '^pay_'),
  idempotency_key uuid not null unique,
  status public.payment_attempt_status not null default 'CREATED',
  payment_method public.checkout_payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  installments smallint not null check (installments between 1 and 10),
  pix_copy_paste text,
  pix_encoded_image text,
  pix_expires_at timestamptz,
  failure_code text,
  provider_status text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_attempts_user_id_idx on public.payment_attempts (user_id);
create index payment_attempts_checkout_draft_id_idx on public.payment_attempts (checkout_draft_id);
create index payment_attempts_status_idx on public.payment_attempts (status);

create table public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  provider_payment_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  attempts integer not null default 0 check (attempts >= 0)
);
create index asaas_webhook_events_provider_payment_id_idx on public.asaas_webhook_events (provider_payment_id);
create index asaas_webhook_events_unprocessed_idx on public.asaas_webhook_events (received_at) where processed_at is null;

create or replace function public.prepare_billing_profile()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  new.user_id := (select auth.uid());
  new.cpf := regexp_replace(new.cpf, '[^0-9]', '', 'g');
  new.updated_at := now();
  return new;
end
$$;
create trigger prepare_billing_profile_before_write before insert or update on public.billing_profiles
for each row execute function public.prepare_billing_profile();

alter table public.billing_profiles enable row level security;
alter table public.billing_profiles force row level security;
alter table public.asaas_customers enable row level security;
alter table public.asaas_customers force row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_attempts force row level security;
alter table public.asaas_webhook_events enable row level security;
alter table public.asaas_webhook_events force row level security;

create policy billing_profiles_select_own on public.billing_profiles for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy billing_profiles_insert_own on public.billing_profiles for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy billing_profiles_update_own on public.billing_profiles for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy payment_attempts_select_own on public.payment_attempts for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on public.billing_profiles from public, anon, authenticated;
grant select on public.billing_profiles to authenticated;
grant insert (cpf) on public.billing_profiles to authenticated;
grant update (cpf) on public.billing_profiles to authenticated;
revoke all on public.asaas_customers from public, anon, authenticated;
revoke all on public.payment_attempts from public, anon, authenticated;
grant select (
  id, checkout_draft_id, provider, provider_payment_id, status, payment_method,
  amount_cents, installments, pix_copy_paste, pix_encoded_image, pix_expires_at,
  failure_code, provider_status, confirmed_at, created_at, updated_at
) on public.payment_attempts to authenticated;
revoke all on public.asaas_webhook_events from public, anon, authenticated;
revoke execute on function public.prepare_billing_profile() from public, anon, authenticated;
grant execute on function public.is_valid_cpf(text) to authenticated;
