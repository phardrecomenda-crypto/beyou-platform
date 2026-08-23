create or replace function private.gamify_checkin() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare previous_date date; next_streak integer;
begin
  perform private.award_gamification(new.user_id,'customer','daily_checkin',10,'checkin:'||new.id::text,jsonb_build_object('checkin_date',new.checkin_date));
  select last_activity_on into previous_date from public.gamification_profiles where user_id=new.user_id for update;
  next_streak:=case when previous_date=new.checkin_date then (select current_streak from public.gamification_profiles where user_id=new.user_id) when previous_date=new.checkin_date-1 then (select current_streak+1 from public.gamification_profiles where user_id=new.user_id) else 1 end;
  update public.gamification_profiles set current_streak=next_streak,longest_streak=greatest(longest_streak,next_streak),last_activity_on=new.checkin_date,updated_at=now() where user_id=new.user_id;
  return new;
end $$;
revoke all on function private.gamify_checkin() from public,anon,authenticated;
