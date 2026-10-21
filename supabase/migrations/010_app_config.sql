-- ATLAS Migration 010: app_config table for runtime AI URL
-- Purpose: single-row key/value store for runtime configuration (AI URL).
-- The app reads `ai_api_url` at startup/foreground; changing it in Supabase
-- takes effect without a new build.
-- Run in Supabase SQL editor. Re-runnable and additive.
-- Rollback: drop table if exists public.app_config;

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Allow read for everyone (anon + authenticated) - no filter needed
create policy if not exists "app_config_read_all"
  on public.app_config
  for select
  using (true);

-- No insert/update/delete for anon/authenticated (only service_role via Supabase dashboard)
revoke insert, update, delete on public.app_config from anon, authenticated;

-- Example row for Zain to run manually (commented out):
-- insert into public.app_config(key, value)
-- values ('ai_api_url', 'https://api.atlas.kz.ci')
-- on conflict (key) do update set value = excluded.value;