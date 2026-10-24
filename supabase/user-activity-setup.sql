-- One-time setup for "User activity" on /analytics (who logged in, when, and how often they visit).
-- Supabase Dashboard  ->  SQL Editor  ->  New query  ->  paste this whole file  ->  Run.
-- Safe to re-run: every statement uses "if not exists". Run analytics-setup.sql first if you
-- never did (it creates analytics_events).

-- Which signed-in user each dashboard visit belongs to.
alter table public.analytics_events add column if not exists username text;
create index if not exists idx_analytics_events_username on public.analytics_events (username);

-- One row per successful sign-in.
create table if not exists public.auth_logins (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  username    text not null,
  is_admin    boolean not null default false,
  device_type text not null default 'desktop',
  browser     text not null default 'Other',
  os          text not null default 'Other'
);

create index if not exists idx_auth_logins_created_at on public.auth_logins (created_at);
create index if not exists idx_auth_logins_username   on public.auth_logins (username);

-- Same as analytics_events: only the server (secret key) reads/writes this table.
alter table public.auth_logins enable row level security;
