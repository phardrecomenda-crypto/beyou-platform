create table public.customer_lifecycle (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'LEAD' check (status in ('LEAD','NEW_CUSTOMER','ACTIVE','ENGAGED','AT_RISK','RENEWAL_DUE','RENEWED','INACTIVE','REACTIVATED')),
  previous_status text check (previous_status is null or previous_status in ('LEAD','NEW_CUSTOMER','ACTIVE','ENGAGED','AT_RISK','RENEWAL_DUE','RENEWED','INACTIVE','REACTIVATED')),
  status_reason text not null default 'profile.created' check (char_length(status_reason) between 1 and 120),
  status_changed_at timestamptz not null default now(),
  last_order_at timestamptz,
  last_engagement_at timestamptz,
  next_action_at timestamptz,
  risk_reason text check (risk_reason is null or char_length(risk_reason) <= 500),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_lifecycle_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_lifecycle(user_id) on delete cascade,
  from_status text check (from_status is null or from_status in ('LEAD','NEW_CUSTOMER','ACTIVE','ENGAGED','AT_RISK','RENEWAL_DUE','RENEWED','INACTIVE','REACTIVATED')),
  to_status text not null check (to_status in ('LEAD','NEW_CUSTOMER','ACTIVE','ENGAGED','AT_RISK','RENEWAL_DUE','RENEWED','INACTIVE','REACTIVATED')),
  reason text not null check (char_length(reason) between 1 and 120),
  source_event_id uuid references public.customer_domain_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index customer_lifecycle_status_action_idx on public.customer_lifecycle(status, next_action_at nulls last);
create index customer_lifecycle_last_engagement_idx on public.customer_lifecycle(last_engagement_at desc nulls last);
create index customer_lifecycle_history_user_occurred_idx on public.customer_lifecycle_history(user_id, occurred_at desc);
create index customer_lifecycle_history_source_event_idx on public.customer_lifecycle_history(source_event_id) where source_event_id is not null;

alter table public.customer_lifecycle enable row level security;
alter table public.customer_lifecycle force row level security;
alter table public.customer_lifecycle_history enable row level security;
alter table public.customer_lifecycle_history force row level security;

revoke all on public.customer_lifecycle, public.customer_lifecycle_history from public, anon, authenticated;
grant select, insert, update on public.customer_lifecycle to service_role;
grant select, insert on public.customer_lifecycle_history to service_role;

create or replace function public.transition_customer_lifecycle(
  p_user_id uuid,
  p_to_status text,
  p_reason text,
  p_source_event_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.customer_lifecycle%rowtype;
  inserted_rows integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'CRM_SERVICE_ROLE_REQUIRED'; end if;
  if p_to_status not in ('LEAD','NEW_CUSTOMER','ACTIVE','ENGAGED','AT_RISK','RENEWAL_DUE','RENEWED','INACTIVE','REACTIVATED') then raise exception 'CRM_STATUS_INVALID'; end if;
  if p_reason is null or char_length(p_reason) not between 1 and 120 then raise exception 'CRM_REASON_INVALID'; end if;
  if not exists(select 1 from public.profiles where id = p_user_id) then raise exception 'CRM_PROFILE_NOT_FOUND'; end if;

  insert into public.customer_lifecycle(user_id, status, status_reason, status_changed_at, last_order_at, last_engagement_at, next_action_at)
  values (
    p_user_id,
    p_to_status,
    p_reason,
    p_occurred_at,
    case when p_to_status in ('NEW_CUSTOMER','RENEWED','REACTIVATED') then p_occurred_at end,
    case when p_to_status in ('ACTIVE','ENGAGED','REACTIVATED') then p_occurred_at end,
    case when p_to_status = 'NEW_CUSTOMER' then p_occurred_at + interval '1 day'
         when p_to_status = 'AT_RISK' then p_occurred_at
         when p_to_status = 'RENEWAL_DUE' then p_occurred_at
         else null end
  )
  on conflict (user_id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 1 then
    insert into public.customer_lifecycle_history(user_id, from_status, to_status, reason, source_event_id, metadata, occurred_at)
    values (p_user_id, null, p_to_status, p_reason, p_source_event_id, coalesce(p_metadata, '{}'::jsonb), p_occurred_at);
    return;
  end if;

  select * into current_row from public.customer_lifecycle where user_id = p_user_id for update;

  if current_row.status = p_to_status then
    update public.customer_lifecycle set
      last_order_at = case when p_to_status in ('NEW_CUSTOMER','RENEWED','REACTIVATED') then greatest(coalesce(last_order_at, p_occurred_at), p_occurred_at) else last_order_at end,
      last_engagement_at = case when p_to_status in ('ACTIVE','ENGAGED','REACTIVATED') then greatest(coalesce(last_engagement_at, p_occurred_at), p_occurred_at) else last_engagement_at end,
      updated_at = greatest(updated_at, p_occurred_at)
    where user_id = p_user_id;
    return;
  end if;

  update public.customer_lifecycle set
    previous_status = current_row.status,
    status = p_to_status,
    status_reason = p_reason,
    status_changed_at = p_occurred_at,
    last_order_at = case when p_to_status in ('NEW_CUSTOMER','RENEWED','REACTIVATED') then greatest(coalesce(last_order_at, p_occurred_at), p_occurred_at) else last_order_at end,
    last_engagement_at = case when p_to_status in ('ACTIVE','ENGAGED','REACTIVATED') then greatest(coalesce(last_engagement_at, p_occurred_at), p_occurred_at) else last_engagement_at end,
    next_action_at = case when p_to_status = 'NEW_CUSTOMER' then p_occurred_at + interval '1 day'
                          when p_to_status in ('AT_RISK','RENEWAL_DUE') then p_occurred_at
                          else null end,
    risk_reason = case when p_to_status = 'AT_RISK' then coalesce(p_metadata->>'risk_reason', p_reason) else null end,
    version = version + 1,
    updated_at = p_occurred_at
  where user_id = p_user_id;

  insert into public.customer_lifecycle_history(user_id, from_status, to_status, reason, source_event_id, metadata, occurred_at)
  values (p_user_id, current_row.status, p_to_status, p_reason, p_source_event_id, coalesce(p_metadata, '{}'::jsonb), p_occurred_at);
end;
$$;

revoke all on function public.transition_customer_lifecycle(uuid,text,text,uuid,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.transition_customer_lifecycle(uuid,text,text,uuid,jsonb,timestamptz) to service_role;

create or replace function public.sync_crm_from_profile() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.transition_customer_lifecycle(new.id, 'LEAD', 'profile.created', null, '{}'::jsonb, new.created_at);
  return new;
end;
$$;

revoke all on function public.sync_crm_from_profile() from public, anon, authenticated;
create trigger profiles_sync_crm after insert on public.profiles for each row execute function public.sync_crm_from_profile();

create or replace function public.sync_crm_from_customer_event() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.event_type = 'assessment.completed' then
    perform public.transition_customer_lifecycle(new.user_id, 'ACTIVE', new.event_type, new.id, new.payload, new.occurred_at);
  elsif new.event_type = 'protocol.started' then
    perform public.transition_customer_lifecycle(new.user_id, 'ACTIVE', new.event_type, new.id, new.payload, new.occurred_at);
  elsif new.event_type = 'checkin.completed' then
    if not exists(select 1 from public.customer_lifecycle where user_id = new.user_id and status in ('RENEWAL_DUE','RENEWED')) then
      perform public.transition_customer_lifecycle(new.user_id, 'ENGAGED', new.event_type, new.id, new.payload, new.occurred_at);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_crm_from_customer_event() from public, anon, authenticated;
create trigger customer_domain_events_sync_crm after insert on public.customer_domain_events for each row execute function public.sync_crm_from_customer_event();

create or replace function public.sync_crm_from_order() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare paid_orders bigint;
begin
  if new.user_id is null or new.status::text not in ('paid','processing','shipped','delivered') then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  select count(*) into paid_orders from public.orders where user_id = new.user_id and status::text in ('paid','processing','shipped','delivered');
  perform public.transition_customer_lifecycle(
    new.user_id,
    case when paid_orders > 1 then 'RENEWED' else 'NEW_CUSTOMER' end,
    case when paid_orders > 1 then 'order.renewed' else 'order.paid' end,
    null,
    jsonb_build_object('order_id', new.id, 'order_number', new.order_number),
    coalesce(new.paid_at, new.updated_at, now())
  );
  return new;
end;
$$;

revoke all on function public.sync_crm_from_order() from public, anon, authenticated;
create trigger orders_sync_crm after insert or update of status on public.orders for each row execute function public.sync_crm_from_order();

insert into public.customer_lifecycle(user_id, status, status_reason, status_changed_at, last_order_at, last_engagement_at, next_action_at)
select p.id,
  case when paid.total > 1 then 'RENEWED' when paid.total = 1 then 'NEW_CUSTOMER' else 'LEAD' end,
  case when paid.total > 1 then 'crm.backfill.renewed' when paid.total = 1 then 'crm.backfill.customer' else 'crm.backfill.lead' end,
  coalesce(paid.last_paid_at, p.created_at),
  paid.last_paid_at,
  engagement.last_engagement_at,
  case when paid.total = 1 then coalesce(paid.last_paid_at, p.created_at) + interval '1 day' end
from public.profiles p
left join lateral (
  select count(*) total, max(coalesce(o.paid_at,o.updated_at)) last_paid_at
  from public.orders o where o.user_id = p.id and o.status::text in ('paid','processing','shipped','delivered')
) paid on true
left join lateral (
  select max(e.occurred_at) last_engagement_at from public.customer_domain_events e
  where e.user_id = p.id and e.event_type in ('assessment.completed','protocol.started','checkin.completed')
) engagement on true
on conflict (user_id) do nothing;

insert into public.customer_lifecycle_history(user_id, from_status, to_status, reason, metadata, occurred_at)
select user_id, null, status, status_reason, jsonb_build_object('backfill', true), status_changed_at
from public.customer_lifecycle
on conflict do nothing;

comment on table public.customer_lifecycle is 'Current auditable customer lifecycle state consumed by CRM, CS and future AI modules.';
comment on table public.customer_lifecycle_history is 'Append-only history of customer lifecycle transitions.';
