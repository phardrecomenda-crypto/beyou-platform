create table public.customer_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  source_order_id uuid not null references public.orders(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED')),
  current_section smallint not null default 1 check (current_section between 1 and 5),
  primary_goal text check (primary_goal in ('WEIGHT_MANAGEMENT','DIGESTIVE_WELLBEING','ENERGY_AND_ROUTINE','SLEEP_QUALITY','HEALTHY_HABITS','OTHER')),
  goal_details text check (goal_details is null or length(goal_details) <= 1000),
  weight_kg numeric(5,2) check (weight_kg between 30 and 350),
  height_cm smallint check (height_cm between 100 and 250),
  age_years smallint check (age_years between 18 and 120),
  biological_sex text check (biological_sex in ('FEMALE','MALE','PREFER_NOT_TO_SAY')),
  routine_description text check (routine_description is null or length(routine_description) <= 2000),
  wake_time time,
  sleep_time time,
  meals_per_day smallint check (meals_per_day between 1 and 12),
  water_liters numeric(3,1) check (water_liters between 0 and 15),
  activity_level text check (activity_level in ('SEDENTARY','LIGHT','MODERATE','INTENSE')),
  activity_description text check (activity_description is null or length(activity_description) <= 1500),
  activity_days_per_week smallint check (activity_days_per_week between 0 and 7),
  food_restrictions text check (food_restrictions is null or length(food_restrictions) <= 1500),
  dietary_preferences text check (dietary_preferences is null or length(dietary_preferences) <= 1500),
  food_allergies text check (food_allergies is null or length(food_allergies) <= 1500),
  health_history text check (health_history is null or length(health_history) <= 2500),
  medications text check (medications is null or length(medications) <= 2000),
  professional_follow_up text check (professional_follow_up is null or length(professional_follow_up) <= 1500),
  pregnancy_status text check (pregnancy_status in ('NOT_APPLICABLE','NO','PREGNANT','BREASTFEEDING','PREFER_NOT_TO_SAY')),
  health_data_consent boolean not null default false,
  health_consent_version text,
  health_consent_at timestamptz,
  started_at timestamptz not null default now(),
  last_saved_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, version),
  check ((status = 'DRAFT' and completed_at is null) or (status = 'COMPLETED' and completed_at is not null)),
  check (health_consent_at is null or health_data_consent)
);

create unique index customer_assessments_one_draft_idx on public.customer_assessments(user_id) where status = 'DRAFT';
create index customer_assessments_user_created_idx on public.customer_assessments(user_id, created_at desc);
create index customer_assessments_source_order_idx on public.customer_assessments(source_order_id);

create table public.customer_domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_version integer not null default 1 check (event_version > 0),
  entity_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  origin text not null,
  correlation_id uuid not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  idempotency_key text not null unique
);
create index customer_domain_events_user_occurred_idx on public.customer_domain_events(user_id, occurred_at desc);
create index customer_domain_events_entity_idx on public.customer_domain_events(entity_id);

alter table public.customer_assessments enable row level security;
alter table public.customer_assessments force row level security;
alter table public.customer_domain_events enable row level security;
alter table public.customer_domain_events force row level security;

create policy customer_assessments_read_own on public.customer_assessments
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.customer_assessments to authenticated;
revoke insert, update, delete on public.customer_assessments from anon, authenticated;
revoke all on public.customer_domain_events from anon, authenticated;

create or replace function public.save_customer_assessment_step(p_section smallint, p_answers jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_order uuid; v_assessment public.customer_assessments%rowtype; v_version integer;
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_section not between 1 and 5 or jsonb_typeof(p_answers) <> 'object' then raise exception 'INVALID_ASSESSMENT_INPUT'; end if;
  if not exists(select 1 from public.customer_onboarding where user_id=v_user and terms_accepted_at is not null) then raise exception 'TERMS_ACCEPTANCE_REQUIRED'; end if;
  select id into v_order from public.orders where user_id=v_user and status in('paid','processing','shipped','delivered') order by created_at desc limit 1;
  if v_order is null then raise exception 'PAID_ORDER_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 20260817));
  select * into v_assessment from public.customer_assessments where user_id=v_user and status='DRAFT' for update;
  if v_assessment.id is null then
    select coalesce(max(version),0)+1 into v_version from public.customer_assessments where user_id=v_user;
    insert into public.customer_assessments(user_id,source_order_id,version) values(v_user,v_order,v_version) returning * into v_assessment;
  end if;
  if p_section=1 then update public.customer_assessments set
    primary_goal=nullif(p_answers->>'primary_goal',''),goal_details=nullif(trim(p_answers->>'goal_details'),''),
    weight_kg=nullif(p_answers->>'weight_kg','')::numeric,height_cm=nullif(p_answers->>'height_cm','')::smallint,
    age_years=nullif(p_answers->>'age_years','')::smallint,biological_sex=nullif(p_answers->>'biological_sex',''),
    current_section=greatest(current_section,2),last_saved_at=now(),updated_at=now() where id=v_assessment.id;
  elsif p_section=2 then update public.customer_assessments set
    routine_description=nullif(trim(p_answers->>'routine_description'),''),wake_time=nullif(p_answers->>'wake_time','')::time,
    sleep_time=nullif(p_answers->>'sleep_time','')::time,meals_per_day=nullif(p_answers->>'meals_per_day','')::smallint,
    water_liters=nullif(p_answers->>'water_liters','')::numeric,current_section=greatest(current_section,3),last_saved_at=now(),updated_at=now() where id=v_assessment.id;
  elsif p_section=3 then update public.customer_assessments set
    activity_level=nullif(p_answers->>'activity_level',''),activity_description=nullif(trim(p_answers->>'activity_description'),''),
    activity_days_per_week=nullif(p_answers->>'activity_days_per_week','')::smallint,current_section=greatest(current_section,4),last_saved_at=now(),updated_at=now() where id=v_assessment.id;
  elsif p_section=4 then update public.customer_assessments set
    food_restrictions=nullif(trim(p_answers->>'food_restrictions'),''),dietary_preferences=nullif(trim(p_answers->>'dietary_preferences'),''),
    food_allergies=nullif(trim(p_answers->>'food_allergies'),''),current_section=greatest(current_section,5),last_saved_at=now(),updated_at=now() where id=v_assessment.id;
  else update public.customer_assessments set
    health_history=nullif(trim(p_answers->>'health_history'),''),medications=nullif(trim(p_answers->>'medications'),''),
    professional_follow_up=nullif(trim(p_answers->>'professional_follow_up'),''),pregnancy_status=nullif(p_answers->>'pregnancy_status',''),
    health_data_consent=coalesce((p_answers->>'health_data_consent')::boolean,false),
    health_consent_version=case when coalesce((p_answers->>'health_data_consent')::boolean,false) then 'health-data-v1' end,
    health_consent_at=case when coalesce((p_answers->>'health_data_consent')::boolean,false) then coalesce(health_consent_at,now()) end,
    current_section=5,last_saved_at=now(),updated_at=now() where id=v_assessment.id;
  end if;
  update public.customer_onboarding set assessment_started_at=coalesce(assessment_started_at,now()),updated_at=now() where user_id=v_user;
  return v_assessment.id;
end $$;

create or replace function public.complete_customer_assessment()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_assessment public.customer_assessments%rowtype;
begin
 if v_user is null then raise exception 'AUTHENTICATION_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,20260817));
 select * into v_assessment from public.customer_assessments where user_id=v_user and status='DRAFT' for update;
 if v_assessment.id is null then raise exception 'ASSESSMENT_NOT_FOUND';end if;
 if v_assessment.primary_goal is null or v_assessment.weight_kg is null or v_assessment.height_cm is null or v_assessment.age_years is null or v_assessment.biological_sex is null
   or nullif(trim(v_assessment.routine_description),'') is null or v_assessment.wake_time is null or v_assessment.sleep_time is null or v_assessment.meals_per_day is null or v_assessment.water_liters is null
   or v_assessment.activity_level is null or nullif(trim(v_assessment.activity_description),'') is null or v_assessment.activity_days_per_week is null
   or nullif(trim(v_assessment.food_restrictions),'') is null or nullif(trim(v_assessment.dietary_preferences),'') is null or nullif(trim(v_assessment.food_allergies),'') is null
   or nullif(trim(v_assessment.health_history),'') is null or nullif(trim(v_assessment.medications),'') is null or nullif(trim(v_assessment.professional_follow_up),'') is null
   or v_assessment.pregnancy_status is null or not v_assessment.health_data_consent then raise exception 'ASSESSMENT_INCOMPLETE'; end if;
 update public.customer_assessments set status='COMPLETED',completed_at=now(),last_saved_at=now(),updated_at=now() where id=v_assessment.id;
 update public.customer_onboarding set current_step='COMPLETED',assessment_completed_at=now(),updated_at=now() where user_id=v_user;
 insert into public.customer_domain_events(event_type,event_version,entity_id,user_id,origin,correlation_id,payload,idempotency_key)
 values('assessment.completed',1,v_assessment.id,v_user,'customer_area',v_assessment.id,jsonb_build_object('assessment_version',v_assessment.version),'assessment:'||v_assessment.id||':completed') on conflict(idempotency_key) do nothing;
 return v_assessment.id;
end $$;

revoke all on function public.save_customer_assessment_step(smallint,jsonb),public.complete_customer_assessment() from public,anon;
grant execute on function public.save_customer_assessment_step(smallint,jsonb),public.complete_customer_assessment() to authenticated;
