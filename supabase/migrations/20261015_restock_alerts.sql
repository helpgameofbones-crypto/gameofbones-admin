create table if not exists public.restock_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  product_name text not null,
  contact_hash text not null,
  pii_email_ciphertext text,
  pii_phone_ciphertext text,
  notification_consent boolean not null default false,
  privacy_notice_version text,
  status text not null default 'pending' check (status in ('pending', 'notified', 'cancelled')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, contact_hash)
);

create index if not exists restock_alerts_status_created_at_idx
  on public.restock_alerts (status, created_at desc);

alter table public.restock_alerts enable row level security;

-- Only the server's service-role client accesses this table. Browser clients
-- must use the validated public endpoint, and admins use the protected route.
revoke all on public.restock_alerts from anon, authenticated;
