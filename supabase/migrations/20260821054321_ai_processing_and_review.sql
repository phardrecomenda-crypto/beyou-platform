create or replace function public.claim_ai_generation(p_generation_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_generation public.ai_generations%rowtype;
begin
  select * into v_generation from public.ai_generations where status='QUEUED' and (p_generation_id is null or id=p_generation_id)
   order by requested_at for update skip locked limit 1;
  if v_generation.id is null then return null; end if;
  update public.ai_generations set status='RUNNING',started_at=now(),updated_at=now() where id=v_generation.id;
  return jsonb_build_object('id',v_generation.id,'user_id',v_generation.user_id,'assessment_id',v_generation.assessment_id,'prompt_version_id',v_generation.prompt_version_id);
end $$;
create or replace function public.complete_ai_generation(p_generation_id uuid,p_provider text,p_model text,p_provider_request_id text,p_result jsonb,p_safety_flags text[] default '{}') returns void language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(p_result)<>'object' or not(p_result?'structured_analysis' and p_result?'weekly_meal_plan' and p_result?'shopping_list' and p_result?'safety_notice') then raise exception 'AI_RESULT_INVALID';end if;
 update public.ai_generations set status='REVIEW_REQUIRED',result=p_result,safety_flags=coalesce(p_safety_flags,'{}'),provider=nullif(trim(p_provider),''),model=nullif(trim(p_model),''),provider_request_id=nullif(trim(p_provider_request_id),''),generated_at=now(),updated_at=now() where id=p_generation_id and status='RUNNING';
 if not found then raise exception 'AI_GENERATION_NOT_RUNNING';end if;
end $$;
create or replace function public.fail_ai_generation(p_generation_id uuid,p_failure_code text) returns void language plpgsql security invoker set search_path='' as $$
begin update public.ai_generations set status='FAILED',failure_code=left(coalesce(nullif(trim(p_failure_code),''),'AI_PROCESSING_FAILED'),80),updated_at=now() where id=p_generation_id and status='RUNNING';if not found then raise exception 'AI_GENERATION_NOT_RUNNING';end if;end $$;
create or replace function public.review_ai_generation(p_generation_id uuid,p_actor_id uuid,p_decision text) returns void language plpgsql security definer set search_path='' as $$
declare v public.ai_generations%rowtype;
begin
 if not exists(select 1 from public.profiles where id=p_actor_id and role in('admin'::public.user_role,'super_admin'::public.user_role))then raise exception 'ADMIN_REQUIRED';end if;
 if p_decision not in('PUBLISH','REJECT')then raise exception 'AI_REVIEW_DECISION_INVALID';end if;
 select * into v from public.ai_generations where id=p_generation_id for update;if v.id is null or v.status<>'REVIEW_REQUIRED'then raise exception 'AI_REVIEW_NOT_AVAILABLE';end if;
 if p_decision='PUBLISH'then update public.ai_generations set status='PUBLISHED',reviewed_by=p_actor_id,reviewed_at=now(),published_at=now(),updated_at=now()where id=p_generation_id;
 else update public.ai_generations set status='REJECTED',reviewed_by=p_actor_id,reviewed_at=now(),updated_at=now()where id=p_generation_id;end if;
 insert into public.customer_domain_events(event_type,event_version,entity_id,user_id,origin,correlation_id,payload,idempotency_key)values(case when p_decision='PUBLISH'then'ai.plan.published'else'ai.plan.rejected'end,1,p_generation_id,v.user_id,'admin',p_generation_id,jsonb_build_object('generation_version',v.generation_version,'safety_flags',v.safety_flags),'ai-plan:'||p_generation_id||case when p_decision='PUBLISH'then':published'else':rejected'end)on conflict(idempotency_key)do nothing;
end $$;
revoke all on function public.claim_ai_generation(uuid),public.complete_ai_generation(uuid,text,text,text,jsonb,text[]),public.fail_ai_generation(uuid,text),public.review_ai_generation(uuid,uuid,text)from public,anon,authenticated;
grant execute on function public.claim_ai_generation(uuid),public.complete_ai_generation(uuid,text,text,text,jsonb,text[]),public.fail_ai_generation(uuid,text),public.review_ai_generation(uuid,uuid,text)to service_role;

