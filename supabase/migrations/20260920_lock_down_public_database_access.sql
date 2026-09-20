-- Apply only after the active storefront has been verified to use its protected
-- API endpoints. This removes browser-side writes and public RPC access while
-- preserving the published catalog reads the storefront requires.
begin;

revoke all privileges on table public.analytics_events, public.banners, public.blogs,
  public.coupons, public.customer_birthdays, public.customer_tags_master,
  public.dog_gallery, public.email_captures, public.feeders, public.product_sizes,
  public.products, public.reviews, public.serviceable_pincodes, public.sessions,
  public.site_content, public.testimonials, public.users from anon, authenticated;

grant select on table public.banners, public.blogs, public.dog_gallery,
  public.product_sizes, public.products, public.reviews, public.site_content,
  public.testimonials to anon, authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

alter function public.add_customer_address(text,text,text,text,text,text,text,boolean) set search_path = pg_catalog, public;
alter function public.check_coupon_usage(text) set search_path = pg_catalog, public;
alter function public.check_phone_order_items(text) set search_path = pg_catalog, public;
alter function public.credit_loyalty_on_delivery() set search_path = pg_catalog, public;
alter function public.decrement_product_stock(text,integer) set search_path = pg_catalog, public;
alter function public.deduct_order_stock() set search_path = pg_catalog, public;
alter function public.delete_customer_address(uuid,text) set search_path = pg_catalog, public;
alter function public.delete_customer_dog(uuid,text) set search_path = pg_catalog, public;
alter function public.gdpr_delete_my_data(text,text) set search_path = pg_catalog, public;
alter function public.get_customer_addresses(text) set search_path = pg_catalog, public;
alter function public.get_customer_coupons(text) set search_path = pg_catalog, public;
alter function public.get_customer_dogs(text) set search_path = pg_catalog, public;
alter function public.get_customer_order_history(text) set search_path = pg_catalog, public;
alter function public.get_customer_profile(text) set search_path = pg_catalog, public;
alter function public.get_customer_rewards(text) set search_path = pg_catalog, public;
alter function public.get_customer_streak(text) set search_path = pg_catalog, public;
alter function public.get_or_create_referral_code(text,text) set search_path = pg_catalog, public;
alter function public.get_order_by_ref(text) set search_path = pg_catalog, public;
alter function public.log_order_status_change() set search_path = pg_catalog, public;
alter function public.orders_bulk_stats(integer) set search_path = pg_catalog, public;
alter function public.orders_by_phone_recent(text,integer) set search_path = pg_catalog, public;
alter function public.orders_items_by_phone_pattern(text) set search_path = pg_catalog, public;
alter function public.recent_orders_public(integer) set search_path = pg_catalog, public;
alter function public.restock_order_on_cancel() set search_path = pg_catalog, public;
alter function public.sync_customer_from_order() set search_path = pg_catalog, public;
alter function public.track_coupon_usage() set search_path = pg_catalog, public;
alter function public.track_orders(text,text) set search_path = pg_catalog, public;
alter function public.update_customer_address(uuid,text,text,text,text,text,text,text,boolean) set search_path = pg_catalog, public;
alter function public.update_customer_contact(text,text,text) set search_path = pg_catalog, public;
alter function public.upsert_customer_dog(uuid,text,text,text,text,text,text,date) set search_path = pg_catalog, public;
alter function public.upsert_customer_profile(text,text,text,text,text,text,text,text,date) set search_path = pg_catalog, public;

alter function public.generate_blog_slug() set search_path = pg_catalog, public;
alter function public.increment_customer_stats(text,numeric) set search_path = pg_catalog, public;
alter function public.update_updated_at() set search_path = pg_catalog, public;
alter function public.gob_xor_decrypt(text) set search_path = pg_catalog, public;
alter function public.gob_decrypt_phone(text) set search_path = pg_catalog, public;
alter function public.gob_normalize_phone(text) set search_path = pg_catalog, public;

commit;
