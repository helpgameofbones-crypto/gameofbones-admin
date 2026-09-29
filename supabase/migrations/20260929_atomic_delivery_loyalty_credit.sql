-- Credit delivery points atomically. The job may be retried, so the order row
-- is locked before changing a customer balance or creating a ledger entry.
create or replace function public.credit_delivery_loyalty_points(
  p_order_id uuid,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;
  v_customer_id uuid;
  v_points integer;
  v_balance integer;
  v_expiry timestamptz := now() + interval '60 days';
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('credited', false, 'reason', 'order_not_found');
  end if;
  if v_order.status <> 'delivered' then
    return jsonb_build_object('credited', false, 'reason', 'not_delivered');
  end if;
  if coalesce(v_order.points_awarded, false) then
    return jsonb_build_object('credited', false, 'reason', 'already_awarded');
  end if;

  v_customer_id := coalesce(v_order.customer_id, p_customer_id);
  if v_customer_id is null then
    return jsonb_build_object('credited', false, 'reason', 'customer_not_linked');
  end if;
  select * into v_customer from public.customers where id = v_customer_id for update;
  if not found then
    return jsonb_build_object('credited', false, 'reason', 'customer_not_found');
  end if;

  v_points := floor(greatest(coalesce(v_order.grand_total, 0), 0) / 10.0)::integer;
  if v_points <= 0 then
    update public.orders set points_awarded = true where id = v_order.id;
    return jsonb_build_object('credited', false, 'reason', 'order_value_too_low');
  end if;

  v_balance := coalesce(v_customer.loyalty_points, 0) + v_points;
  update public.customers
    set loyalty_points = v_balance, loyalty_points_expire_at = v_expiry
    where id = v_customer.id;
  insert into public.loyalty_ledger (customer_id, customer_name, customer_phone, type, points, balance_after, order_ref, description)
    values (v_customer.id, v_customer.name, v_customer.phone, 'earned', v_points, v_balance, v_order.ref, 'Earned on delivery of order ' || v_order.ref);
  update public.orders set points_awarded = true where id = v_order.id;
  insert into public.activity_log (action, entity_type, entity_id, entity_name, details)
    values ('loyalty points added', 'customer', v_customer.id::text, coalesce(v_customer.name, ''), '+' || v_points || ' points — auto-credited on delivery of order ' || v_order.ref);

  return jsonb_build_object(
    'credited', true,
    'points_earned', v_points,
    'balance_after', v_balance,
    'customer_name', coalesce(v_customer.name, ''),
    'customer_email', coalesce(v_customer.email, '')
  );
end;
$$;

revoke all on function public.credit_delivery_loyalty_points(uuid, uuid) from public;
grant execute on function public.credit_delivery_loyalty_points(uuid, uuid) to service_role;
