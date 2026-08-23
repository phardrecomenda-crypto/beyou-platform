begin;
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;
grant select, update on table public.profiles to authenticated;
revoke all privileges on table public.profiles from service_role;
grant select, insert, update, delete on table public.profiles to service_role;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
create index if not exists affiliate_applications_reviewed_by_idx
  on public.affiliate_applications (reviewed_by)
  where reviewed_by is not null;
create index if not exists order_status_history_order_id_idx
  on public.order_status_history (order_id);
commit;
