create table if not exists public.weekly_meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  title text not null default 'Meu cardápio semanal',
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  source text not null default 'self' check (source in ('self','template','professional')),
  meals jsonb not null default '{}'::jsonb check (jsonb_typeof(meals) = 'object'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, week_start)
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_plan_id uuid references public.weekly_meal_plans(id) on delete set null,
  title text not null default 'Lista de compras',
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  checked_count integer not null default 0 check (checked_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gamification_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  customer_xp integer not null default 0 check (customer_xp >= 0),
  affiliate_xp integer not null default 0 check (affiliate_xp >= 0),
  customer_level integer not null default 1 check (customer_level >= 1),
  affiliate_level integer not null default 1 check (affiliate_level >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_activity_on date,
  updated_at timestamptz not null default now()
);

create table if not exists public.gamification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('customer','affiliate')),
  event_key text not null,
  points integer not null check (points between 0 and 10000),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists weekly_meal_plans_user_week_idx on public.weekly_meal_plans(user_id, week_start desc);
create index if not exists shopping_lists_user_updated_idx on public.shopping_lists(user_id, updated_at desc);
create index if not exists gamification_events_user_created_idx on public.gamification_events(user_id, created_at desc);

alter table public.weekly_meal_plans enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.gamification_profiles enable row level security;
alter table public.gamification_events enable row level security;

grant select, insert, update, delete on public.weekly_meal_plans to authenticated;
grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert on public.gamification_profiles to authenticated;
grant select on public.gamification_events to authenticated;

create policy meal_plans_owner_select on public.weekly_meal_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy meal_plans_owner_insert on public.weekly_meal_plans for insert to authenticated with check ((select auth.uid()) = user_id and source = 'self');
create policy meal_plans_owner_update on public.weekly_meal_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and source = 'self');
create policy meal_plans_owner_delete on public.weekly_meal_plans for delete to authenticated using ((select auth.uid()) = user_id and source = 'self');

create policy shopping_lists_owner_select on public.shopping_lists for select to authenticated using ((select auth.uid()) = user_id);
create policy shopping_lists_owner_insert on public.shopping_lists for insert to authenticated with check ((select auth.uid()) = user_id);
create policy shopping_lists_owner_update on public.shopping_lists for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy shopping_lists_owner_delete on public.shopping_lists for delete to authenticated using ((select auth.uid()) = user_id);

create policy gamification_profile_owner_select on public.gamification_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy gamification_profile_owner_initialize on public.gamification_profiles for insert to authenticated with check (
  (select auth.uid()) = user_id and customer_xp = 0 and affiliate_xp = 0 and customer_level = 1 and affiliate_level = 1 and current_streak = 0 and longest_streak = 0
);
create policy gamification_events_owner_select on public.gamification_events for select to authenticated using ((select auth.uid()) = user_id);

create policy meal_plans_admin_all on public.weekly_meal_plans for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy shopping_lists_admin_all on public.shopping_lists for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy gamification_profiles_admin_all on public.gamification_profiles for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy gamification_events_admin_all on public.gamification_events for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

insert into public.gamification_profiles(user_id)
select id from public.profiles
on conflict (user_id) do nothing;
