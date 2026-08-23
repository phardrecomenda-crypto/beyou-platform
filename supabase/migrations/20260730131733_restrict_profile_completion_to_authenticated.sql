revoke execute on function public.complete_my_profile(text,text,date,text,text,text) from public;
revoke execute on function public.complete_my_profile(text,text,date,text,text,text) from anon;
grant execute on function public.complete_my_profile(text,text,date,text,text,text) to authenticated;
