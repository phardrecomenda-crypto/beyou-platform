create table public.affiliate_wallet_entries (
 id uuid primary key default gen_random_uuid(), affiliate_user_id uuid not null references public.affiliate_profiles(user_id) on delete restrict,
 commission_id uuid references public.commission_ledger(id) on delete restrict, payout_request_id uuid,
 entry_type text not null check(entry_type in ('COMMISSION_PENDING','COMMISSION_RELEASED','PAYOUT_REQUESTED','PAYOUT_RESTORED','PAYOUT_PAID','COMMISSION_REVERSED')),
 pending_delta numeric(12,2) not null default 0, available_delta numeric(12,2) not null default 0, paid_delta numeric(12,2) not null default 0,
 idempotency_key text not null unique, metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'), created_at timestamptz not null default now(),
 check(pending_delta<>0 or available_delta<>0 or paid_delta<>0)
);
create table public.affiliate_payout_requests (
 id uuid primary key default gen_random_uuid(), affiliate_user_id uuid not null references public.affiliate_profiles(user_id) on delete restrict,
 amount numeric(12,2) not null check(amount>0), pix_key_type text not null check(pix_key_type in ('CPF','CNPJ','EMAIL','PHONE','EVP')),
 pix_key_masked text not null, pix_key_encrypted text not null, status text not null default 'REQUESTED' check(status in ('REQUESTED','PAID','REJECTED')),
 requested_at timestamptz not null default now(), processed_at timestamptz, processed_by uuid references public.profiles(id) on delete restrict, rejection_reason text,
 check((status='REQUESTED' and processed_at is null) or (status<>'REQUESTED' and processed_at is not null))
);
alter table public.affiliate_wallet_entries add constraint affiliate_wallet_entries_payout_fkey foreign key(payout_request_id) references public.affiliate_payout_requests(id) on delete restrict;
create index affiliate_wallet_entries_owner_created_idx on public.affiliate_wallet_entries(affiliate_user_id,created_at desc);
create index affiliate_payout_requests_owner_created_idx on public.affiliate_payout_requests(affiliate_user_id,requested_at desc);
create view public.affiliate_wallet_balances with(security_invoker=true) as select affiliate_user_id,coalesce(sum(pending_delta),0)::numeric(12,2) pending_amount,coalesce(sum(available_delta),0)::numeric(12,2) available_amount,coalesce(sum(paid_delta),0)::numeric(12,2) paid_amount from public.affiliate_wallet_entries group by affiliate_user_id;
alter table public.affiliate_wallet_entries enable row level security; alter table public.affiliate_wallet_entries force row level security;
alter table public.affiliate_payout_requests enable row level security; alter table public.affiliate_payout_requests force row level security;
create policy wallet_entries_select_own on public.affiliate_wallet_entries for select to authenticated using(affiliate_user_id=auth.uid());
create policy payout_requests_select_own on public.affiliate_payout_requests for select to authenticated using(affiliate_user_id=auth.uid());
grant select on public.affiliate_wallet_entries,public.affiliate_payout_requests,public.affiliate_wallet_balances to authenticated;
revoke insert,update,delete on public.affiliate_wallet_entries,public.affiliate_payout_requests from anon,authenticated;
create or replace function private.sync_affiliate_wallet_commission() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and new.status in('calculated','pending') then insert into public.affiliate_wallet_entries(affiliate_user_id,commission_id,entry_type,pending_delta,idempotency_key) values(new.affiliate_user_id,new.id,'COMMISSION_PENDING',new.amount,'commission:'||new.id||':pending') on conflict do nothing;
 elsif tg_op='UPDATE' and old.status<>new.status then
  if new.status='released' and old.status in('calculated','pending') then insert into public.affiliate_wallet_entries(affiliate_user_id,commission_id,entry_type,pending_delta,available_delta,idempotency_key) values(new.affiliate_user_id,new.id,'COMMISSION_RELEASED',-new.amount,new.amount,'commission:'||new.id||':released') on conflict do nothing;
  elsif new.status in('cancelled','reversed') and old.status in('calculated','pending') then insert into public.affiliate_wallet_entries(affiliate_user_id,commission_id,entry_type,pending_delta,idempotency_key) values(new.affiliate_user_id,new.id,'COMMISSION_REVERSED',-new.amount,'commission:'||new.id||':reversed') on conflict do nothing;
  elsif new.status in('cancelled','reversed') and old.status='released' then insert into public.affiliate_wallet_entries(affiliate_user_id,commission_id,entry_type,available_delta,idempotency_key) values(new.affiliate_user_id,new.id,'COMMISSION_REVERSED',-new.amount,'commission:'||new.id||':reversed') on conflict do nothing; end if;
 end if; return new;
end $$;
create trigger sync_affiliate_wallet_commission after insert or update of status on public.commission_ledger for each row execute function private.sync_affiliate_wallet_commission();
insert into public.affiliate_wallet_entries(affiliate_user_id,commission_id,entry_type,pending_delta,available_delta,paid_delta,idempotency_key,created_at)
select affiliate_user_id,id,'COMMISSION_PENDING',case when status in('calculated','pending') then amount else 0 end,case when status='released' then amount else 0 end,case when status='paid' then amount else 0 end,'commission:'||id||':'||case when status='released' then 'released' when status='paid' then 'paid-import' else 'pending' end,created_at from public.commission_ledger where status in('calculated','pending','released','paid') on conflict do nothing;
create or replace function public.request_affiliate_payout(p_amount numeric,p_pix_key_type text,p_pix_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_available numeric;v_id uuid;v_masked text;
begin if v_user is null then raise exception 'AUTHENTICATION_REQUIRED';end if;if p_amount is null or p_amount<=0 then raise exception 'INVALID_AMOUNT';end if;if p_pix_key_type not in('CPF','CNPJ','EMAIL','PHONE','EVP') or length(trim(p_pix_key))<3 then raise exception 'INVALID_PIX_KEY';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));select coalesce(available_amount,0) into v_available from public.affiliate_wallet_balances where affiliate_user_id=v_user;
 if coalesce(v_available,0)<p_amount then raise exception 'INSUFFICIENT_BALANCE';end if;v_masked:=left(trim(p_pix_key),2)||repeat('*',greatest(length(trim(p_pix_key))-4,2))||right(trim(p_pix_key),2);
 insert into public.affiliate_payout_requests(affiliate_user_id,amount,pix_key_type,pix_key_masked,pix_key_encrypted) values(v_user,p_amount,p_pix_key_type,v_masked,encode(pgp_sym_encrypt(trim(p_pix_key),current_setting('app.settings.jwt_secret',true)),'base64')) returning id into v_id;
 insert into public.affiliate_wallet_entries(affiliate_user_id,payout_request_id,entry_type,available_delta,idempotency_key) values(v_user,v_id,'PAYOUT_REQUESTED',-p_amount,'payout:'||v_id||':requested');return v_id;end $$;
create or replace function public.release_affiliate_commission(p_commission_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;update public.commission_ledger set status='released',released_at=now() where id=p_commission_id and status in('calculated','pending');if not found then raise exception 'COMMISSION_NOT_PENDING';end if;end $$;
create or replace function public.process_affiliate_payout(p_request_id uuid,p_decision text,p_reason text default null) returns void language plpgsql security definer set search_path='' as $$
declare v public.affiliate_payout_requests%rowtype;begin if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;select * into v from public.affiliate_payout_requests where id=p_request_id for update;if v.id is null or v.status<>'REQUESTED' then raise exception 'PAYOUT_NOT_REQUESTED';end if;
 if p_decision='PAID' then update public.affiliate_payout_requests set status='PAID',processed_at=now(),processed_by=auth.uid() where id=v.id;insert into public.affiliate_wallet_entries(affiliate_user_id,payout_request_id,entry_type,paid_delta,idempotency_key) values(v.affiliate_user_id,v.id,'PAYOUT_PAID',v.amount,'payout:'||v.id||':paid');
 elsif p_decision='REJECTED' then update public.affiliate_payout_requests set status='REJECTED',processed_at=now(),processed_by=auth.uid(),rejection_reason=nullif(trim(p_reason),'') where id=v.id;insert into public.affiliate_wallet_entries(affiliate_user_id,payout_request_id,entry_type,available_delta,idempotency_key) values(v.affiliate_user_id,v.id,'PAYOUT_RESTORED',v.amount,'payout:'||v.id||':restored');else raise exception 'INVALID_DECISION';end if;end $$;
revoke all on function public.request_affiliate_payout(numeric,text,text),public.release_affiliate_commission(uuid),public.process_affiliate_payout(uuid,text,text) from public,anon;
grant execute on function public.request_affiliate_payout(numeric,text,text),public.release_affiliate_commission(uuid),public.process_affiliate_payout(uuid,text,text) to authenticated;
