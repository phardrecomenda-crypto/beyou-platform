-- SPRINT 08 — Affiliate Engine foundation
-- Additive migration designed for the existing BEYOU production schema.

alter table public.affiliate_applications force row level security;
alter table public.affiliate_profiles force row level security;
alter table public.affiliate_network force row level security;
alter table public.affiliate_clients force row level security;
alter table public.commission_ledger force row level security;

create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.profiles(id) on delete restrict,
  code text not null,
  destination_path text not null default '/loja',
  campaign text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_links_code_format check (
    code = lower(code) and code ~ '^[a-z0-9][a-z0-9_-]{2,47}$'
  ),
  constraint affiliate_links_destination_internal check (destination_path like '/%')
);

create unique index affiliate_links_code_unique on public.affiliate_links (lower(code));
create index affiliate_links_affiliate_active_idx
  on public.affiliate_links (affiliate_user_id, active, created_at desc);

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  channel text not null,
  beneficiary_type text not null,
  network_level smallint,
  percentage numeric(5,2) not null,
  retroactive boolean not null default false,
  requires_company_approval boolean not null default false,
  requires_service_record boolean not null default false,
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commission_rules_channel_check
    check (channel in ('DIRECT', 'REMARKETING', 'MANAGER', 'RECRUITER')),
  constraint commission_rules_beneficiary_check
    check (beneficiary_type in ('AFFILIATE', 'COMPANY', 'MANAGER', 'RECRUITER')),
  constraint commission_rules_level_check
    check (network_level is null or network_level between 1 and 3),
  constraint commission_rules_percentage_check
    check (percentage > 0 and percentage <= 100),
  constraint commission_rules_validity_check
    check (valid_until is null or valid_until > valid_from),
  constraint commission_rules_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index commission_rules_resolution_idx
  on public.commission_rules (channel, beneficiary_type, network_level, active, valid_from desc);

insert into public.commission_rules
  (rule_key, channel, beneficiary_type, network_level, percentage, retroactive,
   requires_company_approval, requires_service_record, active, metadata)
values
  ('DIRECT_STANDARD_20', 'DIRECT', 'AFFILIATE', null, 20.00, false, false, false, true,
   '{"description":"Comissão direta padrão"}'::jsonb),
  ('DIRECT_UPGRADE_25_RETROACTIVE', 'DIRECT', 'AFFILIATE', null, 25.00, true, true, false, false,
   '{"description":"Evolução retroativa condicionada à aprovação da empresa"}'::jsonb),
  ('REMARKETING_AFFILIATE_15', 'REMARKETING', 'AFFILIATE', null, 15.00, false, false, true, true,
   '{"description":"Parcela do afiliado em venda recuperada com atendimento e SLA"}'::jsonb),
  ('REMARKETING_COMPANY_5', 'REMARKETING', 'COMPANY', null, 5.00, false, false, true, true,
   '{"description":"Parcela da empresa em venda recuperada com atendimento e SLA"}'::jsonb),
  ('MANAGER_LEVEL_1_5', 'MANAGER', 'MANAGER', 1, 5.00, false, false, false, true, '{}'::jsonb),
  ('MANAGER_LEVEL_2_3', 'MANAGER', 'MANAGER', 2, 3.00, false, false, false, true, '{}'::jsonb),
  ('MANAGER_LEVEL_3_2', 'MANAGER', 'MANAGER', 3, 2.00, false, false, false, true, '{}'::jsonb),
  ('RECRUITER_LEVEL_1_3', 'RECRUITER', 'RECRUITER', 1, 3.00, false, false, false, true, '{}'::jsonb),
  ('RECRUITER_LEVEL_2_2', 'RECRUITER', 'RECRUITER', 2, 2.00, false, false, false, true, '{}'::jsonb);

create table public.remarketing_service_records (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.profiles(id) on delete restrict,
  customer_user_id uuid references public.profiles(id) on delete set null,
  source text not null,
  status text not null default 'OPEN',
  opened_at timestamptz not null default now(),
  sla_due_at timestamptz not null,
  first_contact_at timestamptz,
  closed_at timestamptz,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint remarketing_service_status_check
    check (status in ('OPEN', 'IN_PROGRESS', 'WON', 'LOST', 'EXPIRED', 'CANCELLED')),
  constraint remarketing_service_sla_check check (sla_due_at >= opened_at),
  constraint remarketing_service_contact_check
    check (first_contact_at is null or first_contact_at >= opened_at),
  constraint remarketing_service_closed_check
    check (closed_at is null or closed_at >= opened_at),
  constraint remarketing_service_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index remarketing_service_affiliate_status_idx
  on public.remarketing_service_records (affiliate_user_id, status, sla_due_at);
create index remarketing_service_customer_idx
  on public.remarketing_service_records (customer_user_id, created_at desc)
  where customer_user_id is not null;

create table public.sale_attributions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  affiliate_user_id uuid not null references public.profiles(id) on delete restrict,
  affiliate_link_id uuid references public.affiliate_links(id) on delete set null,
  attribution_type text not null,
  remarketing_service_record_id uuid references public.remarketing_service_records(id) on delete restrict,
  attributed_at timestamptz not null default now(),
  locked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint sale_attributions_type_check check (attribution_type in ('DIRECT', 'REMARKETING')),
  constraint sale_attributions_remarketing_check check (
    (attribution_type = 'DIRECT' and remarketing_service_record_id is null)
    or (attribution_type = 'REMARKETING' and remarketing_service_record_id is not null)
  ),
  constraint sale_attributions_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index sale_attributions_affiliate_idx
  on public.sale_attributions (affiliate_user_id, attributed_at desc);
create index sale_attributions_link_idx
  on public.sale_attributions (affiliate_link_id)
  where affiliate_link_id is not null;

alter table public.commission_ledger
  add column rule_id uuid references public.commission_rules(id) on delete restrict,
  add column attribution_id uuid references public.sale_attributions(id) on delete restrict,
  add column idempotency_key text,
  add column beneficiary_type text not null default 'AFFILIATE',
  add column released_at timestamptz,
  add column reversed_at timestamptz,
  add column metadata jsonb not null default '{}'::jsonb;

alter table public.commission_ledger
  drop constraint commission_ledger_status_check;

alter table public.commission_ledger
  add constraint commission_ledger_status_check
    check (status in ('calculated', 'pending', 'released', 'paid', 'cancelled', 'reversed')),
  add constraint commission_ledger_percentage_check
    check (percentage is null or (percentage > 0 and percentage <= 100)),
  add constraint commission_ledger_amounts_check
    check (base_amount >= 0 and amount >= 0),
  add constraint commission_ledger_beneficiary_check
    check (beneficiary_type in ('AFFILIATE', 'MANAGER', 'RECRUITER')),
  add constraint commission_ledger_metadata_object_check
    check (jsonb_typeof(metadata) = 'object');

create unique index commission_ledger_idempotency_unique
  on public.commission_ledger (idempotency_key)
  where idempotency_key is not null;
create index commission_ledger_attribution_idx
  on public.commission_ledger (attribution_id)
  where attribution_id is not null;
create index commission_ledger_rule_idx
  on public.commission_ledger (rule_id)
  where rule_id is not null;

create table public.company_revenue_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  attribution_id uuid not null references public.sale_attributions(id) on delete restrict,
  rule_id uuid not null references public.commission_rules(id) on delete restrict,
  idempotency_key text not null unique,
  percentage numeric(5,2) not null,
  base_amount numeric(12,2) not null,
  amount numeric(12,2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint company_revenue_percentage_check check (percentage > 0 and percentage <= 100),
  constraint company_revenue_amounts_check check (base_amount >= 0 and amount >= 0),
  constraint company_revenue_status_check check (status in ('pending', 'recognized', 'cancelled', 'reversed')),
  constraint company_revenue_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index company_revenue_order_idx on public.company_revenue_allocations (order_id);
create index company_revenue_attribution_idx on public.company_revenue_allocations (attribution_id);

alter table public.affiliate_links enable row level security;
alter table public.affiliate_links force row level security;
alter table public.commission_rules enable row level security;
alter table public.commission_rules force row level security;
alter table public.remarketing_service_records enable row level security;
alter table public.remarketing_service_records force row level security;
alter table public.sale_attributions enable row level security;
alter table public.sale_attributions force row level security;
alter table public.company_revenue_allocations enable row level security;
alter table public.company_revenue_allocations force row level security;

revoke all on public.affiliate_links from public, anon, authenticated;
revoke all on public.commission_rules from public, anon, authenticated;
revoke all on public.remarketing_service_records from public, anon, authenticated;
revoke all on public.sale_attributions from public, anon, authenticated;
revoke all on public.company_revenue_allocations from public, anon, authenticated;

grant select on public.affiliate_links to authenticated;
grant select on public.commission_rules to authenticated;
grant select on public.remarketing_service_records to authenticated;
grant select on public.sale_attributions to authenticated;

create policy affiliate_links_select_own
  on public.affiliate_links for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = affiliate_user_id);

create policy commission_rules_select_active
  on public.commission_rules for select to authenticated
  using (active and valid_from <= now() and (valid_until is null or valid_until > now()));

create policy remarketing_service_select_own
  on public.remarketing_service_records for select to authenticated
  using ((select auth.uid()) is not null and (
    (select auth.uid()) = affiliate_user_id or (select auth.uid()) = customer_user_id
  ));

create policy sale_attributions_select_own
  on public.sale_attributions for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = affiliate_user_id);

comment on table public.commission_rules is
  'Versionable commission contract. Direct sales use 20%; the 25% retroactive upgrade requires company approval. Remarketing uses 15% affiliate plus 5% company and requires an SLA-backed service record.';
comment on table public.remarketing_service_records is
  'Auditable service and SLA evidence required before applying the remarketing split.';
comment on table public.sale_attributions is
  'Immutable order attribution distinguishing direct and remarketing sales.';
comment on table public.company_revenue_allocations is
  'Transparent company share ledger, including the exclusive 5% remarketing allocation.';

