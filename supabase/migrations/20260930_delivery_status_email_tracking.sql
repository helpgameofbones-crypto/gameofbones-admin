-- Transactional delivery updates are idempotent: each state email may be
-- sent once per order, and the timestamp creates an audit trail.
alter table public.orders add column if not exists out_for_delivery_email_sent_at timestamptz;
alter table public.orders add column if not exists delivered_email_sent_at timestamptz;

-- Eligibility is assigned only when a status changes after this migration.
-- That prevents an unintended email blast to historic shipped orders.
alter table public.orders add column if not exists out_for_delivery_email_eligible_at timestamptz;
alter table public.orders add column if not exists delivered_email_eligible_at timestamptz;

create or replace function public.mark_order_delivery_email_eligibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'out_for_delivery' then
      new.out_for_delivery_email_eligible_at = now();
    elsif new.status = 'delivered' then
      new.delivered_email_eligible_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_mark_delivery_email_eligibility on public.orders;
create trigger orders_mark_delivery_email_eligibility
before update of status on public.orders
for each row execute function public.mark_order_delivery_email_eligibility();

create index if not exists orders_out_for_delivery_email_pending_idx
  on public.orders (updated_at)
  where status = 'out_for_delivery' and out_for_delivery_email_eligible_at is not null and out_for_delivery_email_sent_at is null;

create index if not exists orders_delivered_email_pending_idx
  on public.orders (updated_at)
  where status = 'delivered' and delivered_email_eligible_at is not null and delivered_email_sent_at is null;
