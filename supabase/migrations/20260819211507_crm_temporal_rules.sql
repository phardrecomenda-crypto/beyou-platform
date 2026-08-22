alter table public.customer_cycles add column expected_end_at timestamptz;
alter table public.customer_cycles add column lifecycle_rule_version integer;
create index customer_cycles_expected_end_idx on public.customer_cycles(expected_end_at) where status = 'ACTIVE' and expected_end_at is not null;

create table public.crm_lifecycle_rule_sets (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  active boolean not null default false,
  protocol_duration_days integer check (protocol_duration_days between 1 and 365),
  risk_after_days_without_checkin integer check (risk_after_days_without_checkin between 1 and 180),
  renewal_window_days integer not null default 10 check (renewal_window_days between 1 and 60),
  recovery_milestones_days integer[] not null default array[7,15,30,60,90],
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  check (cardinality(recovery_milestones_days) between 1 and 12),
  check (not active or activated_at is not null)
);

create unique index crm_lifecycle_one_active_rule_idx on public.crm_lifecycle_rule_sets(active) where active;
alter table public.crm_lifecycle_rule_sets enable row level security;
alter table public.crm_lifecycle_rule_sets force row level security;
revoke all on public.crm_lifecycle_rule_sets from public, anon, authenticated;
grant select, insert, update on public.crm_lifecycle_rule_sets to service_role;
create policy crm_lifecycle_rule_sets_deny_browser_access on public.crm_lifecycle_rule_sets for all to anon, authenticated using(false) with check(false);

insert into public.crm_lifecycle_rule_sets(version,active,protocol_duration_days,risk_after_days_without_checkin,renewal_window_days,recovery_milestones_days,reason)
values (1,false,null,null,10,array[7,15,30,60,90],'Janela de renovação e marcos de recuperação aprovados. Duração do protocolo e limiar de risco aguardam definição oficial.');

create or replace function public.activate_crm_lifecycle_rules(
  p_version integer,
  p_protocol_duration_days integer,
  p_risk_after_days_without_checkin integer,
  p_reason text
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'CRM_SERVICE_ROLE_REQUIRED';end if;
  if p_protocol_duration_days not between 1 and 365 then raise exception 'CRM_PROTOCOL_DURATION_INVALID';end if;
  if p_risk_after_days_without_checkin not between 1 and 180 then raise exception 'CRM_RISK_WINDOW_INVALID';end if;
  if p_reason is null or char_length(p_reason) not between 3 and 500 then raise exception 'CRM_RULE_REASON_INVALID';end if;
  update public.crm_lifecycle_rule_sets set active=false where active;
  insert into public.crm_lifecycle_rule_sets(version,active,protocol_duration_days,risk_after_days_without_checkin,renewal_window_days,recovery_milestones_days,reason,activated_at)
  values(p_version,true,p_protocol_duration_days,p_risk_after_days_without_checkin,10,array[7,15,30,60,90],p_reason,now())
  on conflict(version) do update set active=true,protocol_duration_days=excluded.protocol_duration_days,risk_after_days_without_checkin=excluded.risk_after_days_without_checkin,reason=excluded.reason,activated_at=now();
  update public.customer_cycles set expected_end_at=started_at+make_interval(days=>p_protocol_duration_days),lifecycle_rule_version=p_version,updated_at=now()
  where status='ACTIVE' and expected_end_at is null;
end $$;
revoke all on function public.activate_crm_lifecycle_rules(integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.activate_crm_lifecycle_rules(integer,integer,integer,text) to service_role;

create or replace function public.evaluate_customer_lifecycle(p_now timestamptz default now()) returns table(transitions integer)
language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;changed integer:=0;current_status text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'CRM_SERVICE_ROLE_REQUIRED';end if;
  for r in
    select c.user_id,c.started_at,c.expected_end_at,c.completed_at,rule.renewal_window_days,rule.risk_after_days_without_checkin,
      (select max(ci.created_at) from public.customer_checkins ci where ci.user_id=c.user_id and ci.cycle_id=c.id) last_checkin
    from public.customer_cycles c left join public.crm_lifecycle_rule_sets rule on rule.active
    where c.status in('ACTIVE','COMPLETED')
  loop
    select status into current_status from public.customer_lifecycle where user_id=r.user_id;
    if r.completed_at is not null and p_now>r.completed_at and current_status not in('RENEWED','REACTIVATED','INACTIVE') then
      perform public.transition_customer_lifecycle(r.user_id,'INACTIVE','cycle.completed',null,jsonb_build_object('completed_at',r.completed_at),r.completed_at);changed:=changed+1;
    elsif r.expected_end_at is not null and r.renewal_window_days is not null and p_now>=r.expected_end_at-make_interval(days=>r.renewal_window_days) and p_now<=r.expected_end_at and current_status not in('RENEWAL_DUE','RENEWED') then
      perform public.transition_customer_lifecycle(r.user_id,'RENEWAL_DUE','renewal.window_started',null,jsonb_build_object('expected_end_at',r.expected_end_at,'window_days',r.renewal_window_days),p_now);changed:=changed+1;
    elsif r.risk_after_days_without_checkin is not null and coalesce(r.last_checkin,r.started_at)<p_now-make_interval(days=>r.risk_after_days_without_checkin) and current_status not in('AT_RISK','RENEWAL_DUE','RENEWED') then
      perform public.transition_customer_lifecycle(r.user_id,'AT_RISK','customer.risk_detected',null,jsonb_build_object('risk_reason','Sem check-in dentro da janela configurada','window_days',r.risk_after_days_without_checkin),p_now);changed:=changed+1;
    end if;
  end loop;
  return query select changed;
end $$;
revoke all on function public.evaluate_customer_lifecycle(timestamptz) from public,anon,authenticated;
grant execute on function public.evaluate_customer_lifecycle(timestamptz) to service_role;

create or replace function public.sync_crm_from_order() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare paid_orders bigint;current_status text;
begin
  if new.user_id is null or new.status::text not in('paid','processing','shipped','delivered') then return new;end if;
  if tg_op='UPDATE' and old.status=new.status then return new;end if;
  select count(*) into paid_orders from public.orders where user_id=new.user_id and status::text in('paid','processing','shipped','delivered');
  select status into current_status from public.customer_lifecycle where user_id=new.user_id;
  perform public.transition_customer_lifecycle(new.user_id,
    case when current_status='INACTIVE' then 'REACTIVATED' when paid_orders>1 then 'RENEWED' else 'NEW_CUSTOMER' end,
    case when current_status='INACTIVE' then 'customer.reactivated' when paid_orders>1 then 'order.renewed' else 'order.paid' end,
    null,jsonb_build_object('order_id',new.id,'order_number',new.order_number),coalesce(new.paid_at,new.updated_at,now()));
  return new;
end $$;
revoke all on function public.sync_crm_from_order() from public,anon,authenticated;

comment on table public.crm_lifecycle_rule_sets is 'Versioned temporal CRM rules. No temporal threshold is activated without an explicit approved duration and risk window.';
comment on column public.customer_cycles.expected_end_at is 'Authoritative expected cycle end used by the D-10 renewal window; remains null until an approved rule is active.';
