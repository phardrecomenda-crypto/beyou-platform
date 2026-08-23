create index ai_prompt_versions_created_by_idx on public.ai_prompt_versions(created_by)
  where created_by is not null;
create index ai_generations_prompt_version_idx on public.ai_generations(prompt_version_id);
create index ai_generations_reviewed_by_idx on public.ai_generations(reviewed_by)
  where reviewed_by is not null;

create policy ai_prompt_versions_deny_clients on public.ai_prompt_versions
  for all to anon, authenticated using (false) with check (false);
create policy ai_generations_deny_clients on public.ai_generations
  for all to anon, authenticated using (false) with check (false);

