-- The public privacy form offers an access request. Keep the database rule in
-- sync with that UI so a legitimate request is accepted and reaches the admin queue.
alter table public.privacy_requests drop constraint if exists privacy_requests_action_check;
alter table public.privacy_requests add constraint privacy_requests_action_check
  check (action in ('access', 'correct', 'delete', 'withdraw_marketing'));

-- Campaign recipients are determined in the trusted server route from these
-- existing consent fields. The indexes keep that check fast for large sends.
create index if not exists orders_marketing_consent_email_hash_idx
  on public.orders (pii_email_hash) where marketing_consent = true;
create index if not exists email_captures_marketing_consent_email_hash_idx
  on public.email_captures (pii_email_hash) where marketing_consent = true;
