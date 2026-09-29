-- Resolve legacy-encrypted customer contact data only inside Postgres. This
-- function is not exposed to browser roles; application routes call it with
-- the Supabase service-role key.
create or replace function public.find_customer_login_identity(p_email text)
returns table (customer_id uuid, customer_phone text)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select c.id, public.gob_normalize_phone(c.phone)
  from public.customers c
  where lower(public.gob_decrypt_phone(c.email)) = lower(trim(p_email))
  limit 2
$$;

revoke all on function public.find_customer_login_identity(text) from public, anon, authenticated;
grant execute on function public.find_customer_login_identity(text) to service_role;
