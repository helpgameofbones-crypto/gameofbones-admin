-- Customer contact-form enquiries. This table is intentionally separate from
-- orders, customers, marketing leads and Delhivery records.
create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('Product question', 'Existing order', 'Shipping question', 'Wholesale / partnership', 'Something else')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  pii_name_ciphertext text not null,
  pii_email_ciphertext text not null,
  pii_message_ciphertext text not null,
  pii_email_hash text,
  pii_key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists contact_inquiries_status_created_at_idx
  on public.contact_inquiries (status, created_at desc);
create index if not exists contact_inquiries_email_hash_idx
  on public.contact_inquiries (pii_email_hash);

alter table public.contact_inquiries enable row level security;
-- There are deliberately no public policies. Storefront submissions go only
-- through the protected server route using the service-role key.
