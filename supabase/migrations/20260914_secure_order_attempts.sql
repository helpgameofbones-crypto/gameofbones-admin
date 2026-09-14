-- Checkout attempts contain customer contact, address, and basket data.
-- All application access is performed with the server-side service-role key.
-- Keep this table inaccessible to browser roles.
alter table public.order_attempts enable row level security;
revoke all on public.order_attempts from anon, authenticated;
