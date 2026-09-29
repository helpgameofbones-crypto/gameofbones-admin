-- Cover foreign keys flagged by the production performance advisor.
create index if not exists customer_dogs_customer_id_idx on public.customer_dogs (customer_id);
create index if not exists influencer_sends_influencer_id_idx on public.influencer_sends (influencer_id);
create index if not exists order_status_log_order_id_idx on public.order_status_log (order_id);
create index if not exists product_reviews_product_id_idx on public.product_reviews (product_id);
create index if not exists product_sizes_product_id_idx on public.product_sizes (product_id);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists refunds_order_id_idx on public.refunds (order_id);
create index if not exists returns_order_id_idx on public.returns (order_id);

-- These pairs have identical definitions. Keep one index in each pair.
drop index if exists public.coupons_code_uniq;
drop index if exists public.idx_orders_created_at;
