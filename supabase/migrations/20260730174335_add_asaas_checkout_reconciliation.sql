alter table public.orders
  add column if not exists asaas_checkout_id text,
  add column if not exists asaas_payment_id text,
  add column if not exists asaas_checkout_status text,
  add column if not exists paid_at timestamptz;

create unique index if not exists orders_asaas_checkout_id_uidx
  on public.orders (asaas_checkout_id)
  where asaas_checkout_id is not null;

create table if not exists public.payment_webhook_events (
  id text primary key,
  event_type text not null,
  external_reference text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from public, anon, authenticated;
grant all on public.payment_webhook_events to service_role;
