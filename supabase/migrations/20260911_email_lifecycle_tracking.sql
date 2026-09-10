-- Additive lifecycle email timestamps. These never alter orders, customers, or other admin data.
-- They allow every transactional email to be sent once and audited safely.
alter table public.orders add column if not exists confirmation_email_sent_at timestamptz;
alter table public.orders add column if not exists dispatch_email_sent_at timestamptz;
alter table public.orders add column if not exists review_request_sent_at timestamptz;
alter table public.email_captures add column if not exists welcome_email_sent_at timestamptz;

create index if not exists orders_review_request_pending_idx
  on public.orders (updated_at)
  where status = 'delivered' and review_request_sent_at is null;
