create table public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  task_type text not null check (task_type in ('CUSTOMER_PLAN')),
  version integer not null check (version > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  active boolean not null default false,
  system_instructions text not null check (length(system_instructions) between 100 and 12000),
  created_by uuid references public.profiles(id) on delete restrict,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_type, version),
  check (not active or activated_at is not null)
);

create unique index ai_prompt_versions_one_active_idx
  on public.ai_prompt_versions(task_type) where active;

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  assessment_id uuid not null references public.customer_assessments(id) on delete restrict,
  cycle_id uuid references public.customer_cycles(id) on delete restrict,
  prompt_version_id uuid not null references public.ai_prompt_versions(id) on delete restrict,
  generation_version integer not null check (generation_version > 0),
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','REVIEW_REQUIRED','PUBLISHED','REJECTED','FAILED')),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  safety_flags text[] not null default '{}',
  provider text,
  model text,
  provider_request_id text,
  failure_code text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  generated_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, generation_version),
  check (status <> 'PUBLISHED' or (
    result ? 'structured_analysis' and result ? 'weekly_meal_plan'
    and result ? 'shopping_list' and result ? 'safety_notice'
    and reviewed_by is not null and reviewed_at is not null and published_at is not null
  )),
  check (status <> 'FAILED' or failure_code is not null)
);

create unique index ai_generations_one_open_idx on public.ai_generations(assessment_id)
  where status in ('QUEUED','RUNNING','REVIEW_REQUIRED');
create index ai_generations_user_requested_idx on public.ai_generations(user_id, requested_at desc);
create index ai_generations_status_requested_idx on public.ai_generations(status, requested_at);
create index ai_generations_cycle_idx on public.ai_generations(cycle_id) where cycle_id is not null;

alter table public.ai_prompt_versions enable row level security;
alter table public.ai_prompt_versions force row level security;
alter table public.ai_generations enable row level security;
alter table public.ai_generations force row level security;

revoke all on public.ai_prompt_versions, public.ai_generations from public, anon, authenticated;

insert into public.ai_prompt_versions(task_type, version, schema_version, active, system_instructions, activated_at)
values (
  'CUSTOMER_PLAN', 1, 1, true,
  'Gere apenas conteúdo educativo de apoio à rotina a partir da anamnese concluída. Não diagnostique, não prescreva, não altere medicamentos e não infira posologia de suplementos. Não recomende restrição extrema, jejum, meta calórica terapêutica ou substituição de acompanhamento profissional. Respeite alergias, restrições, preferências e contexto informado. Sinalize situações incompatíveis com o escopo para revisão humana. A saída deve seguir o contrato estruturado vigente e incluir análise, plano alimentar semanal, lista de compras e aviso de segurança. Orientações de uso de produtos BEYOU somente podem vir de conteúdo regulatório aprovado e versionado, nunca do modelo.',
  now()
);

create or replace function public.request_my_ai_plan()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_assessment public.customer_assessments%rowtype;
  v_prompt uuid;
  v_generation uuid;
  v_version integer;
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not exists (
    select 1 from public.orders o where o.user_id = v_user
      and o.status in ('paid','processing','shipped','delivered')
  ) then raise exception 'PAID_ORDER_REQUIRED'; end if;

  select * into v_assessment from public.customer_assessments
   where user_id = v_user and status = 'COMPLETED'
   order by version desc limit 1;
  if v_assessment.id is null then raise exception 'ASSESSMENT_REQUIRED'; end if;
  if not v_assessment.health_data_consent then raise exception 'HEALTH_CONSENT_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_assessment.id::text, 20260821));
  select id into v_generation from public.ai_generations
   where assessment_id = v_assessment.id and status in ('QUEUED','RUNNING','REVIEW_REQUIRED') limit 1;
  if v_generation is not null then return v_generation; end if;

  select id into v_prompt from public.ai_prompt_versions
   where task_type = 'CUSTOMER_PLAN' and active order by version desc limit 1;
  if v_prompt is null then raise exception 'AI_PROMPT_UNAVAILABLE'; end if;
  select coalesce(max(generation_version), 0) + 1 into v_version
   from public.ai_generations where assessment_id = v_assessment.id;

  insert into public.ai_generations(user_id, assessment_id, prompt_version_id, generation_version)
  values(v_user, v_assessment.id, v_prompt, v_version) returning id into v_generation;
  insert into public.customer_domain_events(event_type,event_version,entity_id,user_id,origin,correlation_id,payload,idempotency_key)
  values('ai.plan.requested',1,v_generation,v_user,'customer_area',v_generation,
    jsonb_build_object('assessment_id',v_assessment.id,'assessment_version',v_assessment.version,'generation_version',v_version),
    'ai-plan:'||v_generation||':requested') on conflict(idempotency_key) do nothing;
  return v_generation;
end $$;

create or replace function public.get_my_ai_plan()
returns table(id uuid, generation_version integer, status text, result jsonb, requested_at timestamptz, published_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  return query
    select g.id, g.generation_version, g.status,
      case when g.status = 'PUBLISHED' then g.result else null end,
      g.requested_at, g.published_at
    from public.ai_generations g where g.user_id = v_user
    order by g.generation_version desc limit 1;
end $$;

revoke all on function public.request_my_ai_plan(), public.get_my_ai_plan() from public, anon;
grant execute on function public.request_my_ai_plan(), public.get_my_ai_plan() to authenticated;

comment on table public.ai_generations is 'Versioned, auditable AI plan jobs linked to the completed assessment; customer output is released only after human review.';
comment on function public.get_my_ai_plan() is 'Returns private customer plan state and withholds generated content until publication.';

