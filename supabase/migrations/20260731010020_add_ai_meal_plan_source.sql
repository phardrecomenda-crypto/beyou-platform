alter table public.weekly_meal_plans
  drop constraint if exists weekly_meal_plans_source_check;

alter table public.weekly_meal_plans
  add constraint weekly_meal_plans_source_check
  check (source = any (array['self'::text, 'template'::text, 'professional'::text, 'ai'::text]));
