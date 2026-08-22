create table public.customer_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  source_order_id uuid not null references public.orders(id) on delete restrict,
  source_assessment_id uuid not null references public.customer_assessments(id) on delete restrict,
  cycle_number integer not null check (cycle_number > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','CANCELLED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cycle_number),
  unique (source_order_id),
  check ((status = 'COMPLETED' and completed_at is not null) or (status <> 'COMPLETED' and completed_at is null))
);

create unique index customer_cycles_one_active_idx on public.customer_cycles(user_id) where status = 'ACTIVE';
create index customer_cycles_user_started_idx on public.customer_cycles(user_id, started_at desc);

create table public.customer_checkins (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.customer_cycles(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  cadence text not null check (cadence in ('DAILY','WEEKLY')),
  checkin_date date not null default current_date,
  weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 30 and 350),
  mood_score smallint not null check (mood_score between 1 and 5),
  energy_score smallint not null check (energy_score between 1 and 5),
  sleep_score smallint not null check (sleep_score between 1 and 5),
  hunger_score smallint not null check (hunger_score between 1 and 5),
  water_liters numeric(3,1) not null check (water_liters between 0 and 15),
  exercise_minutes smallint not null check (exercise_minutes between 0 and 1440),
  notes text check (notes is null or char_length(notes) <= 1000),
  supersedes_checkin_id uuid references public.customer_checkins(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (cycle_id, cadence, checkin_date, supersedes_checkin_id)
);

create unique index customer_checkins_original_once_idx on public.customer_checkins(cycle_id, cadence, checkin_date) where supersedes_checkin_id is null;
create index customer_checkins_user_created_idx on public.customer_checkins(user_id, created_at desc);
create index customer_checkins_cycle_date_idx on public.customer_checkins(cycle_id, checkin_date desc);

alter table public.customer_cycles enable row level security;
alter table public.customer_cycles force row level security;
alter table public.customer_checkins enable row level security;
alter table public.customer_checkins force row level security;

create policy customer_cycles_read_own on public.customer_cycles for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy customer_checkins_read_own on public.customer_checkins for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on public.customer_cycles, public.customer_checkins from public, anon, authenticated;
grant select on public.customer_cycles, public.customer_checkins to authenticated;

create or replace function public.start_customer_protocol()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_order uuid;
  v_assessment uuid;
  v_cycle uuid;
  v_cycle_number integer;
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 20260819));

  select id into v_cycle from public.customer_cycles where user_id = v_user and status = 'ACTIVE';
  if v_cycle is not null then return v_cycle; end if;

  select id, source_order_id into v_assessment, v_order
  from public.customer_assessments
  where user_id = v_user and status = 'COMPLETED'
  order by completed_at desc limit 1;
  if v_assessment is null then raise exception 'ASSESSMENT_REQUIRED'; end if;
  if not exists (
    select 1 from public.orders
    where id = v_order and user_id = v_user and lower(status::text) in ('paid','processing','shipped','delivered')
  ) then raise exception 'ELIGIBLE_ORDER_REQUIRED'; end if;

  select coalesce(max(cycle_number), 0) + 1 into v_cycle_number from public.customer_cycles where user_id = v_user;
  insert into public.customer_cycles(user_id, source_order_id, source_assessment_id, cycle_number)
  values(v_user, v_order, v_assessment, v_cycle_number) returning id into v_cycle;

  update public.customer_onboarding set current_step = 'COMPLETED', updated_at = now() where user_id = v_user;
  insert into public.customer_domain_events(event_type,event_version,entity_id,user_id,origin,correlation_id,payload,idempotency_key)
  values('protocol.started',1,v_cycle,v_user,'customer_area',v_cycle,jsonb_build_object('cycle_number',v_cycle_number),'protocol:'||v_cycle||':started')
  on conflict(idempotency_key) do nothing;
  return v_cycle;
end $$;

create or replace function public.record_customer_checkin(p_answers jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_cycle uuid;
  v_checkin uuid;
  v_cadence text := upper(coalesce(p_answers->>'cadence',''));
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if jsonb_typeof(p_answers) <> 'object' or v_cadence not in ('DAILY','WEEKLY') then raise exception 'INVALID_CHECKIN_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || current_date::text, 20260819));
  select id into v_cycle from public.customer_cycles where user_id = v_user and status = 'ACTIVE' for update;
  if v_cycle is null then raise exception 'ACTIVE_CYCLE_REQUIRED'; end if;
  if exists(select 1 from public.customer_checkins where cycle_id=v_cycle and cadence=v_cadence and checkin_date=current_date and supersedes_checkin_id is null)
    then raise exception 'CHECKIN_ALREADY_RECORDED'; end if;

  insert into public.customer_checkins(cycle_id,user_id,cadence,weight_kg,mood_score,energy_score,sleep_score,hunger_score,water_liters,exercise_minutes,notes)
  values(v_cycle,v_user,v_cadence,nullif(p_answers->>'weight_kg','')::numeric,(p_answers->>'mood_score')::smallint,
    (p_answers->>'energy_score')::smallint,(p_answers->>'sleep_score')::smallint,(p_answers->>'hunger_score')::smallint,
    (p_answers->>'water_liters')::numeric,(p_answers->>'exercise_minutes')::smallint,nullif(trim(p_answers->>'notes'),''))
  returning id into v_checkin;
  insert into public.customer_domain_events(event_type,event_version,entity_id,user_id,origin,correlation_id,payload,idempotency_key)
  values('checkin.completed',1,v_checkin,v_user,'customer_area',v_cycle,jsonb_build_object('cycle_id',v_cycle,'cadence',v_cadence,'checkin_date',current_date),'checkin:'||v_checkin||':completed')
  on conflict(idempotency_key) do nothing;
  return v_checkin;
end $$;

revoke all on function public.start_customer_protocol(), public.record_customer_checkin(jsonb) from public, anon;
grant execute on function public.start_customer_protocol(), public.record_customer_checkin(jsonb) to authenticated;

comment on table public.customer_cycles is 'Versioned customer protocol cycles linked to an eligible order and completed assessment.';
comment on table public.customer_checkins is 'Append-only customer check-ins; corrections must reference the previous record.';
