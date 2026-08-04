create or replace function public.prepare_checkout_draft()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  authenticated_user_id uuid;
  cart_subtotal integer;
  cart_item_count integer;
  free_shipping boolean;
  allowed_installments integer;
begin
  if tg_op = 'UPDATE'
    and old.status = 'READY'
    and new.status = 'COMPLETED'
    and current_user in ('postgres', 'service_role') then
    new.updated_at := now();
    return new;
  end if;

  authenticated_user_id := (select auth.uid());
  if authenticated_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if tg_op = 'UPDATE' and old.status not in ('DRAFT', 'READY') then
    raise exception using errcode = '23514', message = 'CHECKOUT_DRAFT_LOCKED';
  end if;

  select summary.subtotal_cents, summary.item_count, summary.qualifies_for_free_shipping
  into cart_subtotal, cart_item_count, free_shipping
  from public.cart_summaries as summary
  where summary.cart_id = new.cart_id
    and summary.user_id = authenticated_user_id
    and summary.status::text = 'ACTIVE';

  if cart_subtotal is null or cart_item_count < 1 then
    raise exception using errcode = '23514', message = 'CHECKOUT_CART_INVALID';
  end if;
  if not exists (
    select 1 from public.customer_addresses as address
    where address.id = new.address_id and address.user_id = authenticated_user_id
  ) then
    raise exception using errcode = '23503', message = 'CHECKOUT_ADDRESS_INVALID';
  end if;

  new.user_id := authenticated_user_id;
  new.currency := 'BRL';
  new.subtotal_cents := cart_subtotal;
  if new.payment_method = 'PIX' then
    new.installments := 1;
    new.pix_discount_cents := round(cart_subtotal * 0.03)::integer;
  else
    new.pix_discount_cents := 0;
    allowed_installments := case when cart_subtotal <= 49999 then 3 when cart_subtotal <= 99999 then 6 else 10 end;
    if new.installments > allowed_installments then
      raise exception using errcode = '23514', message = 'CHECKOUT_INSTALLMENTS_INVALID',
        detail = format('Maximum installments: %s', allowed_installments);
    end if;
  end if;
  new.shipping_cents := case when free_shipping then 0 else null end;
  new.total_cents := case when new.shipping_cents is null then null
    else cart_subtotal - new.pix_discount_cents + new.shipping_cents end;
  new.status := case when new.shipping_cents is null then 'DRAFT'::public.checkout_status
    else 'READY'::public.checkout_status end;
  new.updated_at := now();
  return new;
end;
$$;

create function public.create_order_from_confirmed_payment(
  selected_provider_payment_id text,
  selected_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_attempt public.payment_attempts%rowtype;
  selected_draft public.checkout_drafts%rowtype;
  selected_address public.customer_addresses%rowtype;
  existing_order_id uuid;
  created_order_id uuid;
begin
  select * into selected_attempt
  from public.payment_attempts
  where provider_payment_id = selected_provider_payment_id
    and status in ('CONFIRMED', 'RECEIVED')
  for update;

  if not found then return null; end if;

  select id into existing_order_id
  from public.orders
  where payment_attempt_id = selected_attempt.id;
  if existing_order_id is not null then return existing_order_id; end if;

  select * into strict selected_draft
  from public.checkout_drafts
  where id = selected_attempt.checkout_draft_id and user_id = selected_attempt.user_id;

  select * into strict selected_address
  from public.customer_addresses
  where id = selected_draft.address_id and user_id = selected_attempt.user_id;

  if selected_draft.status <> 'READY'
    or selected_draft.total_cents is null
    or selected_draft.total_cents <> selected_attempt.amount_cents then
    raise exception using errcode = '23514', message = 'ORDER_PAYMENT_CONTEXT_INVALID';
  end if;

  insert into public.orders (
    user_id, checkout_draft_id, payment_attempt_id, status, currency,
    payment_method, installments, subtotal_cents, discount_cents,
    shipping_cents, total_cents, recipient_name, recipient_phone,
    postal_code, street, address_number, address_complement,
    neighborhood, city, state, paid_at
  ) values (
    selected_attempt.user_id, selected_draft.id, selected_attempt.id, 'PAID', selected_draft.currency,
    selected_attempt.payment_method, selected_attempt.installments, selected_draft.subtotal_cents,
    selected_draft.pix_discount_cents, selected_draft.shipping_cents,
    selected_draft.total_cents, selected_address.recipient_name, selected_address.phone,
    selected_address.postal_code, selected_address.street, selected_address.number,
    selected_address.complement, selected_address.neighborhood, selected_address.city,
    selected_address.state, selected_attempt.confirmed_at
  ) returning id into created_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, product_sku,
    unit_price_cents, quantity, line_total_cents
  )
  select created_order_id, item.product_id, item.product_name, item.product_sku,
    item.unit_price_cents, item.quantity, item.line_total_cents
  from public.cart_items as item
  where item.cart_id = selected_draft.cart_id;

  if not found then
    raise exception using errcode = '23514', message = 'ORDER_ITEMS_REQUIRED';
  end if;

  insert into public.order_status_history (
    order_id, from_status, to_status, source, correlation_id
  ) values (
    created_order_id, null, 'PAID', 'PAYMENT', selected_correlation_id
  );

  update public.checkout_drafts set status = 'COMPLETED' where id = selected_draft.id;
  update public.carts set status = 'CONVERTED' where id = selected_draft.cart_id and status = 'ACTIVE';

  return created_order_id;
exception
  when unique_violation then
    select id into existing_order_id from public.orders where payment_attempt_id = selected_attempt.id;
    return existing_order_id;
end;
$$;

revoke execute on function public.create_order_from_confirmed_payment(text, text)
from public, anon, authenticated;
grant execute on function public.create_order_from_confirmed_payment(text, text)
to service_role;

comment on function public.create_order_from_confirmed_payment(text, text)
is 'Atomically converts one confirmed payment into one immutable order and converted cart.';
