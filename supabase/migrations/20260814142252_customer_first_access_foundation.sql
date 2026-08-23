create table public.legal_documents (
  id uuid primary key default gen_random_uuid(), document_type text not null check (document_type in ('TERMS_OF_USE','PRIVACY_NOTICE')),
  version text not null, title text not null, body text not null, content_hash text not null,
  is_active boolean not null default false, published_at timestamptz not null default now(), created_at timestamptz not null default now(), unique (document_type, version)
);
create unique index legal_documents_one_active_type_idx on public.legal_documents(document_type) where is_active;
create table public.customer_onboarding (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  current_step text not null default 'WELCOME' check (current_step in ('WELCOME','TERMS','ASSESSMENT','COMPLETED')),
  welcomed_at timestamptz, terms_accepted_at timestamptz, assessment_started_at timestamptz, assessment_completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (assessment_completed_at is null or assessment_started_at is not null)
);
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
  document_id uuid not null references public.legal_documents(id) on delete restrict, accepted_at timestamptz not null default now(),
  user_agent text, unique (user_id, document_id)
);
create index legal_acceptances_user_accepted_idx on public.legal_acceptances(user_id, accepted_at desc);
alter table public.legal_documents enable row level security; alter table public.legal_documents force row level security;
alter table public.customer_onboarding enable row level security; alter table public.customer_onboarding force row level security;
alter table public.legal_acceptances enable row level security; alter table public.legal_acceptances force row level security;
create policy legal_documents_read_active on public.legal_documents for select to anon, authenticated using (is_active);
create policy customer_onboarding_read_own on public.customer_onboarding for select to authenticated using ((select auth.uid()) = user_id);
create policy legal_acceptances_read_own on public.legal_acceptances for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.legal_documents to anon, authenticated;
grant select on public.customer_onboarding, public.legal_acceptances to authenticated;
revoke insert, update, delete on public.legal_documents, public.customer_onboarding, public.legal_acceptances from anon, authenticated;
insert into public.legal_documents(document_type,version,title,body,content_hash,is_active) values (
 'TERMS_OF_USE','2026-08-14','Termo de Uso e Acompanhamento Digital BEYOU',
 E'A Área do Cliente BEYOU organiza informações de compra, primeiro acesso, anamnese e acompanhamento do protocolo.\n\nAs informações fornecidas pelo cliente devem ser verdadeiras e completas. O acompanhamento digital tem finalidade educativa e de apoio à rotina e não substitui consulta, diagnóstico, prescrição ou atendimento de profissionais de saúde.\n\nDados pessoais e dados de saúde serão tratados somente para as finalidades informadas, com acesso restrito e controles de segurança. O cliente poderá solicitar atendimento pelos canais oficiais da BEYOU.\n\nAo aceitar, o cliente confirma que leu esta versão e concorda em prosseguir para a anamnese. A anamnese somente será liberada após o aceite.',
 'sha256:57782bee2982d08723a13b422c30f78a43370b42b9b102df87cfa23870b269a6',true
);
create or replace function public.accept_customer_terms(p_document_id uuid,p_user_agent text default null) returns void language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); begin
 if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED';end if;
 if not exists(select 1 from public.orders where user_id=v_user_id and status in('paid','processing','shipped','delivered')) then raise exception 'PAID_ORDER_REQUIRED';end if;
 if not exists(select 1 from public.legal_documents where id=p_document_id and document_type='TERMS_OF_USE' and is_active) then raise exception 'ACTIVE_TERMS_REQUIRED';end if;
 insert into public.legal_acceptances(user_id,document_id,user_agent) values(v_user_id,p_document_id,left(nullif(trim(p_user_agent),''),500)) on conflict(user_id,document_id) do nothing;
 insert into public.customer_onboarding(user_id,current_step,welcomed_at,terms_accepted_at,updated_at) values(v_user_id,'ASSESSMENT',now(),now(),now())
 on conflict(user_id) do update set current_step=case when public.customer_onboarding.current_step in('WELCOME','TERMS') then 'ASSESSMENT' else public.customer_onboarding.current_step end,welcomed_at=coalesce(public.customer_onboarding.welcomed_at,excluded.welcomed_at),terms_accepted_at=coalesce(public.customer_onboarding.terms_accepted_at,excluded.terms_accepted_at),updated_at=now();
end $$;
revoke all on function public.accept_customer_terms(uuid,text) from public,anon;
grant execute on function public.accept_customer_terms(uuid,text) to authenticated;
