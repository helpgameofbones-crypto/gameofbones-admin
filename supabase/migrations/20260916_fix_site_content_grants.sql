-- Keep the storefront content readable, but prevent browser-side writes.
begin;

alter table public.site_content enable row level security;
revoke all on table public.site_content from anon, authenticated;

drop policy if exists "anon can write site_content" on public.site_content;
drop policy if exists "public can read site content" on public.site_content;
create policy "public can read site content" on public.site_content
  for select to anon, authenticated using (true);

grant select on public.site_content to anon, authenticated;

commit;
