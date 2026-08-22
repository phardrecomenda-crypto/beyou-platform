revoke all on public.support_sla_rule_sets,public.support_tickets,public.support_ticket_events from service_role;
grant select,insert,update on public.support_sla_rule_sets,public.support_tickets to service_role;
grant select,insert on public.support_ticket_events to service_role;

revoke all on sequence public.support_tickets_ticket_number_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.support_tickets_ticket_number_seq to service_role;

