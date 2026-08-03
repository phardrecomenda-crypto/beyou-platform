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
  new.expires_at := now() + interval '30 minutes';
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.prepare_checkout_draft() from public, anon, authenticated;
