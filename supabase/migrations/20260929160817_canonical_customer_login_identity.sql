-- Legacy checkouts occasionally created more than one profile for the same
-- email address. Email is verified before a session is created, so select the
-- most active profile deterministically instead of making account access fail.
create or replace function public.find_customer_login_identity(p_email text)
returns table (customer_id uuid, customer_phone text)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select c.id, public.gob_normalize_phone(c.phone)
  from public.customers c
  where lower(public.gob_decrypt_phone(c.email)) = lower(trim(p_email))
    and public.gob_normalize_phone(c.phone) <> '9999999999'
  order by coalesce(c.total_orders, 0) desc,
           c.last_order_date desc nulls last,
           c.created_at desc,
           c.id desc
  limit 1
$$;

revoke all on function public.find_customer_login_identity(text) from public, anon, authenticated;
grant execute on function public.find_customer_login_identity(text) to service_role;
