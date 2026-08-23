create index if not exists shopping_lists_meal_plan_idx on public.shopping_lists(meal_plan_id);

drop policy if exists meal_plans_owner_select on public.weekly_meal_plans;
drop policy if exists meal_plans_owner_insert on public.weekly_meal_plans;
drop policy if exists meal_plans_owner_update on public.weekly_meal_plans;
drop policy if exists meal_plans_owner_delete on public.weekly_meal_plans;
drop policy if exists meal_plans_admin_all on public.weekly_meal_plans;
create policy meal_plans_select on public.weekly_meal_plans for select to authenticated using ((select auth.uid()) = user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy meal_plans_insert on public.weekly_meal_plans for insert to authenticated with check (((select auth.uid()) = user_id and source='self') or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy meal_plans_update on public.weekly_meal_plans for update to authenticated using ((select auth.uid()) = user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (((select auth.uid()) = user_id and source='self') or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy meal_plans_delete on public.weekly_meal_plans for delete to authenticated using (((select auth.uid()) = user_id and source='self') or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists shopping_lists_owner_select on public.shopping_lists;
drop policy if exists shopping_lists_owner_insert on public.shopping_lists;
drop policy if exists shopping_lists_owner_update on public.shopping_lists;
drop policy if exists shopping_lists_owner_delete on public.shopping_lists;
drop policy if exists shopping_lists_admin_all on public.shopping_lists;
create policy shopping_lists_select on public.shopping_lists for select to authenticated using ((select auth.uid()) = user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy shopping_lists_insert on public.shopping_lists for insert to authenticated with check ((select auth.uid()) = user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy shopping_lists_update on public.shopping_lists for update to authenticated using ((select auth.uid()) = user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check ((select auth.uid()) = user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy shopping_lists_delete on public.shopping_lists for delete to authenticated using ((select auth.uid()) = user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists gamification_profile_owner_select on public.gamification_profiles;
drop policy if exists gamification_profile_owner_initialize on public.gamification_profiles;
drop policy if exists gamification_profiles_admin_all on public.gamification_profiles;
create policy gamification_profiles_select on public.gamification_profiles for select to authenticated using ((select auth.uid()) = user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy gamification_profiles_insert on public.gamification_profiles for insert to authenticated with check (((select auth.uid()) = user_id and customer_xp=0 and affiliate_xp=0 and customer_level=1 and affiliate_level=1 and current_streak=0 and longest_streak=0) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy gamification_profiles_admin_update on public.gamification_profiles for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy gamification_profiles_admin_delete on public.gamification_profiles for delete to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists gamification_events_owner_select on public.gamification_events;
drop policy if exists gamification_events_admin_all on public.gamification_events;
create policy gamification_events_select on public.gamification_events for select to authenticated using ((select auth.uid()) = user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy gamification_events_admin_insert on public.gamification_events for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy gamification_events_admin_update on public.gamification_events for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy gamification_events_admin_delete on public.gamification_events for delete to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
