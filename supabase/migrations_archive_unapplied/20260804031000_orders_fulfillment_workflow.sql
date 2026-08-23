alter table public.orders
  add column tracking_code text,
  add column shipping_carrier text,
  add column shipped_at timestamptz,
  add column delivered_at timestamptz;

alter table public.orders add constraint orders_tracking_pair check (
  (tracking_code is null and shipping_carrier is null)
  or (nullif(btrim(tracking_code), '') is not null and nullif(btrim(shipping_carrier), '') is not null)
);

create function public.update_order_fulfillment(
  p_order_id uuid,
  p_next_status public.order_status,
  p_actor_id uuid,
  p_tracking_code text default null,
  p_shipping_carrier text default null
) returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.orders;
  updated_order public.orders;
  normalized_tracking text := nullif(btrim(p_tracking_code), '');
  normalized_carrier text := nullif(btrim(p_shipping_carrier), '');
begin
  select * into selected_order from public.orders where id = p_order_id for update;
  if selected_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_actor_id is null then raise exception 'ACTOR_REQUIRED'; end if;

  if not (
    (selected_order.status = 'PAID' and p_next_status in ('PROCESSING','CANCELLED','REFUNDED'))
    or (selected_order.status = 'PROCESSING' and p_next_status in ('SHIPPED','CANCELLED','REFUNDED'))
    or (selected_order.status = 'SHIPPED' and p_next_status in ('DELIVERED','REFUNDED'))
    or (selected_order.status = 'DELIVERED' and p_next_status = 'REFUNDED')
  ) then raise exception 'ORDER_TRANSITION_INVALID'; end if;

  if p_next_status = 'SHIPPED' and (normalized_tracking is null or normalized_carrier is null) then
    raise exception 'TRACKING_REQUIRED';
  end if;

  update public.orders set
    status = p_next_status,
    tracking_code = case when p_next_status = 'SHIPPED' then normalized_tracking else tracking_code end,
    shipping_carrier = case when p_next_status = 'SHIPPED' then normalized_carrier else shipping_carrier end,
    shipped_at = case when p_next_status = 'SHIPPED' then now() else shipped_at end,
    delivered_at = case when p_next_status = 'DELIVERED' then now() else delivered_at end
  where id = p_order_id returning * into updated_order;

  insert into public.order_status_history(order_id, from_status, to_status, source, correlation_id, metadata)
  values (
    p_order_id, selected_order.status, p_next_status, 'ADMIN', p_actor_id::text,
    case when p_next_status = 'SHIPPED' then jsonb_build_object('tracking_code', normalized_tracking, 'shipping_carrier', normalized_carrier) else '{}'::jsonb end
  );
  return updated_order;
end;
$$;

revoke execute on function public.update_order_fulfillment(uuid, public.order_status, uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_order_fulfillment(uuid, public.order_status, uuid, text, text) to service_role;

comment on function public.update_order_fulfillment is 'Atomic, service-role-only order transition with immutable audit history.';
