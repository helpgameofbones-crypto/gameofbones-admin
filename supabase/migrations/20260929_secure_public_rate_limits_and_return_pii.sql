-- Shared, service-role-only rate limit counter for public API endpoints.
create table if not exists public.request_rate_limits (
  scope text not null check (scope ~ '^[a-z0-9-]{2,80}$'),
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash)
);

alter table public.request_rate_limits enable row level security;
revoke all on table public.request_rate_limits from public, anon, authenticated;

create or replace function public.consume_request_rate_limit(
  p_scope text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  insert into public.request_rate_limits as limits (scope, subject_hash, window_started_at, count, updated_at)
  values (p_scope, p_subject, now(), 1, now())
  on conflict (scope, subject_hash) do update
  set
    window_started_at = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else limits.window_started_at
    end,
    count = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else limits.count + 1
    end,
    updated_at = now()
  returning count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_request_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_request_rate_limit(text, text, integer, integer) to service_role;

alter table public.returns
  add column if not exists pii_name_ciphertext text,
  add column if not exists pii_phone_ciphertext text,
  add column if not exists pii_phone_hash text,
  add column if not exists pii_key_version smallint not null default 1;
