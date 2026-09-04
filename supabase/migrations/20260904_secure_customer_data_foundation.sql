-- Safe, idempotent foundation for the staged customer-data migration.
-- Run this in the Supabase SQL Editor before enabling the scheduled migration.
-- It adds fields only; it does not remove or alter legacy customer columns.

alter table public.orders add column if not exists pii_name_ciphertext text;
alter table public.orders add column if not exists pii_phone_ciphertext text;
alter table public.orders add column if not exists pii_email_ciphertext text;
alter table public.orders add column if not exists pii_address_ciphertext text;
alter table public.orders add column if not exists pii_phone_hash text;
alter table public.orders add column if not exists pii_email_hash text;
alter table public.orders add column if not exists pii_key_version integer;

create index if not exists orders_pii_phone_hash_idx on public.orders (pii_phone_hash);
create index if not exists orders_pii_email_hash_idx on public.orders (pii_email_hash);
create index if not exists orders_created_at_desc_idx on public.orders (created_at desc);

-- Intentionally do not enable RLS here. Several legacy admin screens still
-- use direct browser queries; enable strict policies only after all of those
-- screens have been moved behind protected /api/admin routes.
