begin;

create or replace function public.prepare_checkout_draft()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  cart_subtotal integer;
  cart_item_count integer;
  free_shipping boolean;
  allowed_installments integer;
begin
  if tg_op = 'UPDATE' and old.status = 'READY' and new.status = 'COMPLETED'
     and current_user in ('postgres', 'service_role') then
    new.updated_at := now();
    return new;
  end if;
  if authenticated_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if tg_op = 'UPDATE' and old.status not in ('DRAFT', 'READY') then
    raise exception using errcode = '23514', message = 'CHECKOUT_DRAFT_LOCKED';
  end if;

  select subtotal_cents, item_count, qualifies_for_free_shipping
    into cart_subtotal, cart_item_count, free_shipping
  from public.cart_summaries
  where cart_id = new.cart_id and user_id = authenticated_user_id
    and status = 'ACTIVE';

  if cart_subtotal is null or cart_item_count < 1 then
    raise exception using errcode = '23514', message = 'CHECKOUT_CART_INVALID';
  end if;
  if not exists (
    select 1 from public.customer_addresses
    where id = new.address_id and user_id = authenticated_user_id
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
      raise exception using errcode = '23514', message = 'CHECKOUT_INSTALLMENTS_INVALID';
    end if;
  end if;

  new.shipping_cents := case when free_shipping then 0 else 990 end;
  new.total_cents := cart_subtotal - new.pix_discount_cents + new.shipping_cents;
  new.status := 'READY'::public.checkout_status;
  new.expires_at := now() + interval '30 minutes';
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.prepare_checkout_draft() from public, anon, authenticated;

commit;
