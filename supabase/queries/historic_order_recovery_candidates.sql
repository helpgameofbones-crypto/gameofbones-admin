-- Read-only review list for legacy orders whose line items were not captured.
-- Do not update these rows automatically: confirm each candidate against the
-- matching Razorpay payment record before changing fulfilment data.
with broken_orders as (
  select
    o.id,
    o.ref,
    o.created_at,
    o.transaction_id,
    o.grand_total,
    o.payment_method,
    o.payment_status,
    o.status,
    o.items
  from public.orders as o
  where jsonb_typeof(coalesce(o.items, '[]'::jsonb)) = 'array'
    and exists (
      select 1
      from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
      where nullif(btrim(coalesce(item->>'product_name', item->>'name', '')), '') is null
    )
)
select
  o.ref,
  o.created_at,
  o.transaction_id,
  o.payment_method,
  o.payment_status,
  o.status,
  o.grand_total,
  o.items as stored_items,
  attempt.items as matching_checkout_attempt_items,
  attempt.subtotal as matching_checkout_attempt_subtotal,
  attempt.created_at as checkout_attempt_created_at
from broken_orders as o
left join lateral (
  select a.items, a.subtotal, a.created_at
  from public.order_attempts as a
  where a.ref = o.ref
    and jsonb_typeof(coalesce(a.items, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(a.items, '[]'::jsonb)) > 0
  order by a.created_at desc
  limit 1
) as attempt on true
order by o.created_at desc;
