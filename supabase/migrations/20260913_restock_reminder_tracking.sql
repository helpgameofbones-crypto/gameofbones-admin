-- A customer should receive the 20-40 day restock reminder once per cycle,
-- not once each day that the scheduled job sees them as eligible.
alter table public.customers
  add column if not exists restock_reminder_sent_at timestamptz;

create index if not exists customers_restock_reminder_idx
  on public.customers (restock_reminder_sent_at)
  where restock_reminder_sent_at is null;
