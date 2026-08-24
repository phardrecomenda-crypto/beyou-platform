create or replace function public.mark_my_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ begin
 if (select auth.uid()) is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=(select auth.uid());
 if not found then raise exception 'NOTIFICATION_NOT_FOUND'; end if;
end; $$;
revoke all on function public.mark_my_notification_read(uuid) from public,anon;
grant execute on function public.mark_my_notification_read(uuid) to authenticated;
