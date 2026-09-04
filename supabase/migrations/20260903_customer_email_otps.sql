-- One-time login codes are stored as HMAC hashes, never as plaintext.
create table if not exists public.customer_email_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^\\d{10}$'),
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_email_otps_lookup_idx on public.customer_email_otps (phone, code_hash, expires_at desc) where used_at is null;
alter table public.customer_email_otps enable row level security;
-- No anon/authenticated policies: only the server's service-role key may access this table.
