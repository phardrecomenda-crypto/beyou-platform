create schema if not exists private;

create or replace function private.award_gamification(p_user_id uuid, p_scope text, p_event_key text, p_points integer, p_idempotency_key text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare inserted_count integer;
begin
  if p_user_id is null or p_scope not in ('customer','affiliate') or p_points < 0 or p_points > 10000 then return; end if;
  insert into public.gamification_profiles(user_id) values(p_user_id) on conflict(user_id) do nothing;
  insert into public.gamification_events(user_id,scope,event_key,points,idempotency_key,metadata)
  values(p_user_id,p_scope,p_event_key,p_points,p_idempotency_key,coalesce(p_metadata,'{}'::jsonb))
  on conflict(idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return; end if;
  if p_scope='customer' then
    update public.gamification_profiles set customer_xp=customer_xp+p_points, customer_level=1+((customer_xp+p_points)/250), updated_at=now() where user_id=p_user_id;
  else
    update public.gamification_profiles set affiliate_xp=affiliate_xp+p_points, affiliate_level=1+((affiliate_xp+p_points)/250), updated_at=now() where user_id=p_user_id;
  end if;
end;
$$;
revoke all on function private.award_gamification(uuid,text,text,integer,text,jsonb) from public, anon, authenticated;

create or replace function private.gamify_anamnesis() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$ begin perform private.award_gamification(new.user_id,'customer','anamnesis_completed',50,'anamnesis:'||new.id::text,jsonb_build_object('anamnesis_id',new.id)); return new; end $$;
create or replace function private.gamify_meal_plan() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$ begin perform private.award_gamification(new.user_id,'customer','meal_plan_created',30,'meal-plan:'||new.id::text,jsonb_build_object('meal_plan_id',new.id)); return new; end $$;
create or replace function private.gamify_shopping_list() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$ begin perform private.award_gamification(new.user_id,'customer','shopping_list_created',20,'shopping-list:'||new.id::text,jsonb_build_object('shopping_list_id',new.id)); return new; end $$;
create or replace function private.gamify_checkin() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$ begin perform private.award_gamification(new.user_id,'customer','daily_checkin',10,'checkin:'||new.id::text,jsonb_build_object('checkin_date',new.checkin_date)); return new; end $$;
create or replace function private.gamify_paid_order() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$ begin if new.status='paid' and old.status is distinct from 'paid' then perform private.award_gamification(new.user_id,'customer','order_paid',100,'paid-order:'||new.id::text,jsonb_build_object('order_id',new.id)); end if; return new; end $$;
create or replace function private.gamify_network_member() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$ begin perform private.award_gamification(new.owner_user_id,'affiliate','network_member_added',25,'network-member:'||new.id::text,jsonb_build_object('level',new.level)); return new; end $$;
create or replace function private.gamify_paid_commission() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$ begin if new.status='paid' and old.status is distinct from 'paid' then perform private.award_gamification(new.affiliate_user_id,'affiliate','commission_paid',50,'paid-commission:'||new.id::text,jsonb_build_object('commission_id',new.id)); end if; return new; end $$;

revoke all on function private.gamify_anamnesis() from public,anon,authenticated;
revoke all on function private.gamify_meal_plan() from public,anon,authenticated;
revoke all on function private.gamify_shopping_list() from public,anon,authenticated;
revoke all on function private.gamify_checkin() from public,anon,authenticated;
revoke all on function private.gamify_paid_order() from public,anon,authenticated;
revoke all on function private.gamify_network_member() from public,anon,authenticated;
revoke all on function private.gamify_paid_commission() from public,anon,authenticated;

drop trigger if exists gamify_anamnesis_after_insert on public.anamneses;
create trigger gamify_anamnesis_after_insert after insert on public.anamneses for each row execute function private.gamify_anamnesis();
drop trigger if exists gamify_meal_plan_after_insert on public.weekly_meal_plans;
create trigger gamify_meal_plan_after_insert after insert on public.weekly_meal_plans for each row execute function private.gamify_meal_plan();
drop trigger if exists gamify_shopping_list_after_insert on public.shopping_lists;
create trigger gamify_shopping_list_after_insert after insert on public.shopping_lists for each row execute function private.gamify_shopping_list();
drop trigger if exists gamify_checkin_after_insert on public.daily_checkins;
create trigger gamify_checkin_after_insert after insert on public.daily_checkins for each row execute function private.gamify_checkin();
drop trigger if exists gamify_paid_order_after_update on public.orders;
create trigger gamify_paid_order_after_update after update of status on public.orders for each row execute function private.gamify_paid_order();
drop trigger if exists gamify_network_member_after_insert on public.affiliate_network;
create trigger gamify_network_member_after_insert after insert on public.affiliate_network for each row execute function private.gamify_network_member();
drop trigger if exists gamify_paid_commission_after_update on public.commission_ledger;
create trigger gamify_paid_commission_after_update after update of status on public.commission_ledger for each row execute function private.gamify_paid_commission();
