-- Harden direct Data API access. Storefront and admin server routes use the
-- service role; it bypasses RLS and is never exposed to the browser.
begin;

-- These tables contain customer, order, operational, financial, or staff data
-- and are accessed through protected server routes only.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'abandoned_carts', 'activity_log', 'ad_spend', 'audit_log', 'audit_logs',
    'contact_inquiries', 'coupon_usage', 'customer_addresses',
    'customer_dogs', 'customer_email_otps', 'customers', 'dog_birthdays',
    'expenses', 'influencer_sends', 'influencers', 'loyalty_ledger',
    'milestones', 'nps_surveys', 'order_attempts', 'order_status_log',
    'orders', 'packaging_materials', 'privacy_requests', 'product_bundles',
    'product_categories', 'product_reviews', 'production_batches',
    'referrals', 'refunds', 'reorder_alerts', 'returns', 'rewards',
    'staff_accounts', 'strays', 'streaks', 'subscriptions', 'suppliers',
    'team_members', 'utm_links', 'site_content'
  ] loop
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

-- Remove policies that granted unrestricted browser writes or exposed private
-- operational data. The protected service-role routes continue to work.
drop policy if exists "anon can insert abandoned carts" on public.abandoned_carts;
drop policy if exists "anon can read abandoned carts" on public.abandoned_carts;
drop policy if exists "anon can update abandoned carts" on public.abandoned_carts;
drop policy if exists "anon can insert audit_log" on public.audit_log;
drop policy if exists "anon can read audit_log" on public.audit_log;
drop policy if exists "anon can write dog_gallery" on public.dog_gallery;
drop policy if exists "anon can write strays" on public.strays;
drop policy if exists "anon can manage referrals" on public.referrals;
drop policy if exists "anon can write reorder_alerts" on public.reorder_alerts;
drop policy if exists "anon read reorder_alerts" on public.reorder_alerts;
drop policy if exists "anon can write site_content" on public.site_content;
drop policy if exists "anon can write products" on public.products;
drop policy if exists "orders_public_insert" on public.orders;
drop policy if exists "anon can insert orders" on public.orders;
drop policy if exists "anon can read all products" on public.products;
create policy "public can read active products" on public.products
  for select to anon, authenticated using (is_active = true);

-- Preserve intentionally public reads where the storefront may use them.
grant select on public.products to anon, authenticated;
grant select on public.product_sizes to anon, authenticated;
grant select on public.blogs to anon, authenticated;
grant select on public.banners to anon, authenticated;
grant select on public.dog_gallery to anon, authenticated;
grant select on public.site_content to anon, authenticated;

commit;
