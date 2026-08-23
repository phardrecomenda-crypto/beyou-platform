begin;

alter table public.affiliate_applications
  add column if not exists review_notes text;

drop policy if exists affiliate_applications_insert_own
  on public.affiliate_applications;

create policy affiliate_applications_insert_own
on public.affiliate_applications
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and requested_role = 'affiliate'::public.user_role
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

create or replace function public.review_affiliate_application(
  p_application_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_application public.affiliate_applications%rowtype;
  generated_code text;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_reviewer_id
      and p.role = 'admin'::public.user_role
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_DECISION';
  end if;

  select *
    into selected_application
  from public.affiliate_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'APPLICATION_NOT_FOUND';
  end if;

  if selected_application.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'APPLICATION_ALREADY_REVIEWED';
  end if;

  update public.affiliate_applications
  set status = p_decision,
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      review_notes = nullif(btrim(p_review_notes), ''),
      updated_at = now()
  where id = p_application_id;

  if p_decision = 'rejected' then
    return jsonb_build_object(
      'status', 'rejected',
      'application_id', p_application_id
    );
  end if;

  generated_code := 'BY' || upper(substr(replace(selected_application.user_id::text, '-', ''), 1, 10));

  insert into public.affiliate_profiles (
    user_id,
    affiliate_code,
    focus,
    active
  ) values (
    selected_application.user_id,
    generated_code,
    'affiliate'::public.user_role,
    true
  )
  on conflict (user_id) do update
  set active = true,
      updated_at = now();

  return jsonb_build_object(
    'status', 'approved',
    'application_id', p_application_id,
    'affiliate_user_id', selected_application.user_id,
    'affiliate_code', generated_code
  );
end;
$$;

revoke all on function public.review_affiliate_application(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_affiliate_application(uuid, uuid, text, text)
  to service_role;

comment on function public.review_affiliate_application(uuid, uuid, text, text)
is 'Revisa candidaturas e ativa afiliados atomicamente. Exclusiva do backend administrativo.';

commit;
