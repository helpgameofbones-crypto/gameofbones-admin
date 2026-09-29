-- A registration is held only until the email code is verified. Customer
-- records are not created for mistyped or unverified email addresses.
create table public.customer_registration_otps (
  id uuid primary key default gen_random_uuid(),
  name_ciphertext text not null,
  email_ciphertext text not null,
  phone_ciphertext text not null,
  email_hash text not null,
  phone_hash text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  pii_key_version smallint not null default 1,
  constraint customer_registration_otps_expires_after_created check (expires_at > created_at)
);

create index customer_registration_otps_lookup_idx
  on public.customer_registration_otps (email_hash, phone_hash, created_at desc)
  where used_at is null;

alter table public.customer_registration_otps enable row level security;
revoke all on table public.customer_registration_otps from public, anon, authenticated;

-- Called only from server routes using the service role. The function is not
-- exposed to browser roles, and resolves encrypted historic customer fields.
create or replace function public.customer_registration_available(p_email text, p_phone text)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select not exists (
    select 1
    from public.customers c
    where lower(public.gob_decrypt_phone(c.email)) = lower(trim(p_email))
       or public.gob_normalize_phone(c.phone) = public.gob_normalize_phone(p_phone)
  );
$$;

revoke all on function public.customer_registration_available(text, text) from public, anon, authenticated;
grant execute on function public.customer_registration_available(text, text) to service_role;
