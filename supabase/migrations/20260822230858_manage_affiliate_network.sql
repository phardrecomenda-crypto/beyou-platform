-- Administrative, auditable management of manager and recruiter networks.
create index if not exists affiliate_network_member_active_idx
  on public.affiliate_network (member_user_id, active, relationship_type, level);

create or replace function public.manage_affiliate_network_member(
  p_actor_id uuid,
  p_owner_user_id uuid,
  p_member_user_id uuid,
  p_parent_user_id uuid,
  p_level public.network_level,
  p_relationship_type text,
  p_active boolean default true
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  owner_focus text;
begin
  if p_actor_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=p_actor_id and role in ('admin','super_admin')) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_owner_user_id=p_member_user_id or p_parent_user_id=p_member_user_id then
    raise exception 'INVALID_NETWORK_CYCLE';
  end if;
  if p_relationship_type not in ('manager','recruiter') then
    raise exception 'INVALID_RELATIONSHIP_TYPE';
  end if;
  select focus::text into owner_focus from public.affiliate_profiles where user_id=p_owner_user_id and active;
  if owner_focus is distinct from p_relationship_type then
    raise exception 'OWNER_FOCUS_MISMATCH';
  end if;
  if not exists(select 1 from public.affiliate_profiles where user_id=p_member_user_id and active) then
    raise exception 'ACTIVE_AFFILIATE_REQUIRED';
  end if;
  insert into public.affiliate_network(owner_user_id,member_user_id,parent_user_id,level,relationship_type,active)
  values(p_owner_user_id,p_member_user_id,p_parent_user_id,p_level,p_relationship_type,p_active)
  on conflict(owner_user_id,member_user_id) do update set
    parent_user_id=excluded.parent_user_id,level=excluded.level,
    relationship_type=excluded.relationship_type,active=excluded.active
  returning id into result_id;
  return result_id;
end;
$$;

revoke all on function public.manage_affiliate_network_member(uuid,uuid,uuid,uuid,public.network_level,text,boolean) from public,anon,authenticated;
grant execute on function public.manage_affiliate_network_member(uuid,uuid,uuid,uuid,public.network_level,text,boolean) to service_role;
