-- Verified product reviews are submitted only by a signed-in customer who has
-- a paid, delivered order containing that product. Photos stay in a private
-- storage bucket and are exposed only after moderation.
alter table public.product_reviews
  add column if not exists photo_path text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists review_points_awarded_at timestamptz,
  add column if not exists reward_points integer not null default 0;

create unique index if not exists product_reviews_one_customer_product_idx
  on public.product_reviews (customer_phone, product_id)
  where customer_phone is not null and product_id is not null;

create index if not exists product_reviews_public_feed_idx
  on public.product_reviews (product_id, created_at desc)
  where status = 'published';

create index if not exists product_reviews_moderation_queue_idx
  on public.product_reviews (status, created_at asc)
  where status = 'pending';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
