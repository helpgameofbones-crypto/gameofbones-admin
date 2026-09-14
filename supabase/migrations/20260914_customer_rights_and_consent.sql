-- Customer consent and DPDP-style request handling. Apply in Supabase before deploying the matching code.
alter table public.email_captures add column if not exists marketing_consent boolean not null default false;
alter table public.email_captures add column if not exists marketing_consent_at timestamptz;
alter table public.email_captures add column if not exists privacy_notice_version text;

alter table public.orders add column if not exists marketing_consent boolean not null default false;
alter table public.orders add column if not exists marketing_consent_at timestamptz;
alter table public.orders add column if not exists privacy_notice_version text;
alter table public.orders add column if not exists checkout_policy_acknowledged_at timestamptz;

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  action text not null check (action in ('correct', 'delete', 'withdraw_marketing')),
  status text not null default 'received' check (status in ('received', 'in_review', 'verified', 'completed', 'declined')),
  details text,
  owner_note text,
  privacy_notice_version text,
  pii_email_ciphertext text not null,
  pii_phone_ciphertext text not null,
  pii_email_hash text not null,
  pii_phone_hash text not null,
  pii_key_version integer not null default 1
);

create index if not exists privacy_requests_status_created_idx on public.privacy_requests(status, created_at desc);
create index if not exists privacy_requests_email_hash_idx on public.privacy_requests(pii_email_hash);
alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from anon, authenticated;
