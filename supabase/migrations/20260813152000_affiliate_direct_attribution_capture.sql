-- SPRINT 08 — Capture direct affiliate attribution from link to paid order.

alter table public.carts
  add column affiliate_link_id uuid references public.affiliate_links(id) on delete set null,
  add column attribution_captured_at timestamptz;

create index carts_affiliate_link_idx
  on public.carts (affiliate_link_id)
  where affiliate_link_id is not null;

create or replace function private.create_direct_sale_attribution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  captured_link_id uuid;
  captured_affiliate_id uuid;
  captured_campaign text;
  captured_at timestamptz;
begin
  select link.id, link.affiliate_user_id, link.campaign, cart.attribution_captured_at
    into captured_link_id, captured_affiliate_id, captured_campaign, captured_at
  from public.checkout_drafts as draft
  join public.carts as cart on cart.id = draft.cart_id
  join public.affiliate_links as link on link.id = cart.affiliate_link_id
  join public.affiliate_profiles as profile
    on profile.user_id = link.affiliate_user_id and profile.active
  where draft.id = new.checkout_draft_id and link.active;

  if found and captured_affiliate_id <> new.user_id then
    insert into public.sale_attributions (
      order_id, affiliate_user_id, affiliate_link_id, attribution_type,
      attributed_at, locked_at, metadata
    ) values (
      new.id, captured_affiliate_id, captured_link_id, 'DIRECT',
      coalesce(captured_at, now()), now(),
      jsonb_build_object('source', 'AFFILIATE_LINK', 'campaign', captured_campaign)
    ) on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger orders_capture_direct_affiliate_attribution
after insert on public.orders
for each row execute function private.create_direct_sale_attribution();

comment on function private.create_direct_sale_attribution() is
  'Locks a validated first-touch affiliate link into the immutable sale attribution when the paid order is created.';
