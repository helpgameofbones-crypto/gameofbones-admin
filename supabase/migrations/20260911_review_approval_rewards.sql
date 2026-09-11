-- Reviews remain public only after moderation. A reward record is tied to one
-- review so approving the same review twice can never credit points twice.
alter table public.reviews add column if not exists status text not null default 'pending';
alter table public.reviews add column if not exists approved_at timestamptz;
alter table public.reviews add column if not exists approved_by text;
alter table public.reviews add column if not exists review_points_awarded_at timestamptz;

-- Before this migration the storefront awarded points directly on submission.
-- Preserve that history and prevent a later admin approval from crediting it a
-- second time. Reviews submitted after this migration remain pending.
update public.reviews
set status = 'approved',
    approved_at = coalesce(approved_at, created_at, now()),
    review_points_awarded_at = coalesce(review_points_awarded_at, created_at, now())
where review_points_awarded_at is null;

alter table public.rewards add column if not exists review_id text;
create unique index if not exists rewards_one_review_reward_idx
  on public.rewards (review_id)
  where review_id is not null;

create index if not exists reviews_moderation_queue_idx
  on public.reviews (status, created_at desc);
