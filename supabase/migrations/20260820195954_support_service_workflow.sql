create or replace function public.add_support_ticket_message(
  p_ticket_id uuid,
  p_actor_id uuid,
  p_actor_kind text,
  p_message text
) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_role text;
begin
  if p_actor_kind not in ('CUSTOMER','STAFF') then raise exception 'invalid actor kind'; end if;
  if char_length(trim(p_message)) not between 1 and 4000 then raise exception 'invalid message'; end if;
  select * into v_ticket from public.support_tickets where id=p_ticket_id for update;
  if not found then raise exception 'ticket not found'; end if;
  if v_ticket.status in ('CLOSED','CANCELLED') then raise exception 'ticket is closed'; end if;

  if p_actor_kind='CUSTOMER' then
    if v_ticket.requester_id<>p_actor_id then raise exception 'ticket ownership mismatch'; end if;
    if v_ticket.status='WAITING_CUSTOMER' then
      update public.support_tickets set status='IN_PROGRESS',updated_at=now() where id=p_ticket_id;
      insert into public.support_ticket_events(ticket_id,actor_id,event_type,from_status,to_status,metadata)
      values(p_ticket_id,p_actor_id,'STATUS_CHANGED','WAITING_CUSTOMER','IN_PROGRESS',jsonb_build_object('source','customer_reply'));
    end if;
  else
    select upper(role::text) into v_role from public.profiles where id=p_actor_id;
    if coalesce(v_role,'') not in ('ADMIN','SUPER_ADMIN','SUPORTE') then raise exception 'staff role required'; end if;
    update public.support_tickets
      set first_responded_at=coalesce(first_responded_at,now()),
          status=case when status='OPEN' then 'IN_PROGRESS' else status end,
          updated_at=now()
      where id=p_ticket_id;
    if v_ticket.status='OPEN' then
      insert into public.support_ticket_events(ticket_id,actor_id,event_type,from_status,to_status,metadata)
      values(p_ticket_id,p_actor_id,'STATUS_CHANGED','OPEN','IN_PROGRESS',jsonb_build_object('source','first_staff_reply'));
    end if;
  end if;

  insert into public.support_ticket_events(ticket_id,actor_id,event_type,message,metadata)
  values(p_ticket_id,p_actor_id,'MESSAGE',trim(p_message),jsonb_build_object('actor_kind',p_actor_kind));
end $$;

create or replace function public.manage_support_ticket(
  p_ticket_id uuid,
  p_actor_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assigned_to uuid default null,
  p_change_assignment boolean default false
) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_role text;
  v_assignee_role text;
begin
  select upper(role::text) into v_role from public.profiles where id=p_actor_id;
  if coalesce(v_role,'') not in ('ADMIN','SUPER_ADMIN','SUPORTE') then raise exception 'staff role required'; end if;
  select * into v_ticket from public.support_tickets where id=p_ticket_id for update;
  if not found then raise exception 'ticket not found'; end if;

  if p_priority is not null then
    if p_priority not in ('LOW','NORMAL','HIGH','URGENT') then raise exception 'invalid priority'; end if;
    if p_priority<>v_ticket.priority then
      update public.support_tickets set priority=p_priority,updated_at=now() where id=p_ticket_id;
      insert into public.support_ticket_events(ticket_id,actor_id,event_type,metadata)
      values(p_ticket_id,p_actor_id,'PRIORITY_CHANGED',jsonb_build_object('from',v_ticket.priority,'to',p_priority));
      v_ticket.priority:=p_priority;
    end if;
  end if;

  if p_change_assignment then
    if p_assigned_to is not null then
      select upper(role::text) into v_assignee_role from public.profiles where id=p_assigned_to;
      if coalesce(v_assignee_role,'') not in ('ADMIN','SUPER_ADMIN','SUPORTE') then raise exception 'invalid assignee'; end if;
    end if;
    if v_ticket.assigned_to is distinct from p_assigned_to then
      update public.support_tickets set assigned_to=p_assigned_to,updated_at=now() where id=p_ticket_id;
      insert into public.support_ticket_events(ticket_id,actor_id,event_type,metadata)
      values(p_ticket_id,p_actor_id,'ASSIGNED',jsonb_build_object('from',v_ticket.assigned_to,'to',p_assigned_to));
    end if;
  end if;

  if p_status is not null and p_status<>v_ticket.status then
    if p_status not in ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED','CANCELLED') then raise exception 'invalid status'; end if;
    if not (
      (v_ticket.status='OPEN' and p_status in ('IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CANCELLED')) or
      (v_ticket.status='IN_PROGRESS' and p_status in ('WAITING_CUSTOMER','RESOLVED','CANCELLED')) or
      (v_ticket.status='WAITING_CUSTOMER' and p_status in ('IN_PROGRESS','RESOLVED','CANCELLED')) or
      (v_ticket.status='RESOLVED' and p_status in ('IN_PROGRESS','CLOSED'))
    ) then raise exception 'invalid status transition'; end if;
    update public.support_tickets set
      status=p_status,
      resolved_at=case when p_status='RESOLVED' then now() when p_status='IN_PROGRESS' then null else resolved_at end,
      closed_at=case when p_status='CLOSED' then now() else closed_at end,
      updated_at=now()
    where id=p_ticket_id;
    insert into public.support_ticket_events(ticket_id,actor_id,event_type,from_status,to_status,metadata)
    values(p_ticket_id,p_actor_id,case when p_status='RESOLVED' then 'RESOLVED' when p_status='CLOSED' then 'CLOSED' else 'STATUS_CHANGED' end,v_ticket.status,p_status,'{}');
  end if;
end $$;

revoke all on function public.add_support_ticket_message(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.manage_support_ticket(uuid,uuid,text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.add_support_ticket_message(uuid,uuid,text,text) to service_role;
grant execute on function public.manage_support_ticket(uuid,uuid,text,text,uuid,boolean) to service_role;

comment on function public.add_support_ticket_message(uuid,uuid,text,text) is 'Service-only atomic support conversation mutation with ownership and staff-role validation.';
comment on function public.manage_support_ticket(uuid,uuid,text,text,uuid,boolean) is 'Service-only atomic support workflow mutation with role, assignee and transition validation.';
