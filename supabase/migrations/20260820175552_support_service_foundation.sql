create table public.support_sla_rule_sets (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  active boolean not null default false,
  first_response_minutes integer check (first_response_minutes between 1 and 43200),
  resolution_minutes integer check (resolution_minutes between 1 and 129600),
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  check (not active or (activated_at is not null and first_response_minutes is not null and resolution_minutes is not null)),
  check (resolution_minutes is null or first_response_minutes is null or resolution_minutes >= first_response_minutes)
);

create unique index support_sla_one_active_rule_idx on public.support_sla_rule_sets(active) where active;

insert into public.support_sla_rule_sets(version,active,reason)
values (1,false,'Fundação do SAC aprovada. Tempos de primeira resposta e resolução aguardam definição oficial.');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  sla_rule_id uuid references public.support_sla_rule_sets(id) on delete restrict,
  channel text not null default 'PLATFORM' check (channel in ('PLATFORM','EMAIL','WHATSAPP','PHONE','OTHER')),
  category text not null check (category in ('ORDER','PAYMENT','DELIVERY','PRODUCT','PROTOCOL','ACCOUNT','AFFILIATE','OTHER')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED','CANCELLED')),
  subject text not null check (char_length(subject) between 5 and 140),
  description text not null check (char_length(description) between 10 and 4000),
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (first_response_due_at is null or first_response_due_at >= created_at),
  check (resolution_due_at is null or resolution_due_at >= created_at),
  check (first_responded_at is null or first_responded_at >= created_at),
  check (resolved_at is null or resolved_at >= created_at),
  check (closed_at is null or closed_at >= created_at)
);

create index support_tickets_requester_created_idx on public.support_tickets(requester_id,created_at desc);
create index support_tickets_queue_idx on public.support_tickets(status,priority,created_at) where status in ('OPEN','IN_PROGRESS','WAITING_CUSTOMER');
create index support_tickets_assigned_idx on public.support_tickets(assigned_to,status,created_at) where assigned_to is not null;
create index support_tickets_order_idx on public.support_tickets(order_id) where order_id is not null;

create table public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('CREATED','ASSIGNED','STATUS_CHANGED','PRIORITY_CHANGED','MESSAGE','SLA_STARTED','SLA_BREACHED','RESOLVED','CLOSED')),
  from_status text,
  to_status text,
  message text check (message is null or char_length(message) between 1 and 4000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

create index support_ticket_events_ticket_created_idx on public.support_ticket_events(ticket_id,created_at,id);

alter table public.support_sla_rule_sets enable row level security;
alter table public.support_sla_rule_sets force row level security;
alter table public.support_tickets enable row level security;
alter table public.support_tickets force row level security;
alter table public.support_ticket_events enable row level security;
alter table public.support_ticket_events force row level security;

revoke all on public.support_sla_rule_sets,public.support_tickets,public.support_ticket_events from public,anon,authenticated;
grant select,insert,update on public.support_sla_rule_sets,public.support_tickets to service_role;
grant select,insert on public.support_ticket_events to service_role;
grant usage,select on sequence public.support_tickets_ticket_number_seq to service_role;

create policy support_sla_deny_browser on public.support_sla_rule_sets for all to anon,authenticated using(false) with check(false);
create policy support_tickets_deny_browser on public.support_tickets for all to anon,authenticated using(false) with check(false);
create policy support_ticket_events_deny_browser on public.support_ticket_events for all to anon,authenticated using(false) with check(false);

create or replace function public.log_support_ticket_created() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  insert into public.support_ticket_events(ticket_id,actor_id,event_type,to_status,metadata)
  values(new.id,new.requester_id,'CREATED',new.status,jsonb_build_object('channel',new.channel,'category',new.category,'priority',new.priority));
  return new;
end $$;
revoke all on function public.log_support_ticket_created() from public,anon,authenticated;
grant execute on function public.log_support_ticket_created() to service_role;

create trigger support_ticket_created_event after insert on public.support_tickets
for each row execute function public.log_support_ticket_created();

comment on table public.support_tickets is 'Auditable BEYOU customer service tickets with immutable protocol number and optional versioned SLA.';
comment on table public.support_ticket_events is 'Append-only service history. Corrections create new events and never erase prior evidence.';
comment on table public.support_sla_rule_sets is 'Versioned SLA contract. No time target is active until explicitly approved.';
