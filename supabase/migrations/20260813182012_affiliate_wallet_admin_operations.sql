create or replace function public.list_affiliate_payouts_for_admin(p_actor_id uuid)
returns table(id uuid,affiliate_user_id uuid,affiliate_name text,amount numeric,status text,pix_key_type text,pix_key text,pix_key_masked text,requested_at timestamptz,processed_at timestamptz,rejection_reason text)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where profiles.id=p_actor_id and profiles.role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 return query select r.id,r.affiliate_user_id,coalesce(p.full_name,'Afiliado BEYOU'),r.amount,r.status,r.pix_key_type,pgp_sym_decrypt(decode(r.pix_key_encrypted,'base64'),current_setting('app.settings.jwt_secret',true))::text,r.pix_key_masked,r.requested_at,r.processed_at,r.rejection_reason from public.affiliate_payout_requests r join public.profiles p on p.id=r.affiliate_user_id order by case when r.status='REQUESTED' then 0 else 1 end,r.requested_at desc limit 200;
end $$;
revoke all on function public.list_affiliate_payouts_for_admin(uuid) from public,anon,authenticated;
grant execute on function public.list_affiliate_payouts_for_admin(uuid) to service_role;
