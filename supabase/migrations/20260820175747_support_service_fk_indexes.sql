create index support_ticket_events_actor_idx on public.support_ticket_events(actor_id) where actor_id is not null;
create index support_tickets_sla_rule_idx on public.support_tickets(sla_rule_id) where sla_rule_id is not null;
