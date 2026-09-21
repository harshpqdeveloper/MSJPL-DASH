-- One-time setup for the private /analytics visitor dashboard.
-- Supabase Dashboard  ->  SQL Editor  ->  New query  ->  paste this whole file  ->  Run.
-- Safe to re-run: every statement uses "if not exists".

create table if not exists public.analytics_events (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  visitor_id     text not null,
  session_id     text not null,
  path           text not null,
  referrer_host  text,
  traffic_source text not null default 'direct',
  device_type    text not null default 'desktop',
  browser        text not null default 'Other',
  os             text not null default 'Other'
);

create index if not exists idx_analytics_events_created_at on public.analytics_events (created_at);
create index if not exists idx_analytics_events_visitor_id on public.analytics_events (visitor_id);
create index if not exists idx_analytics_events_session_id on public.analytics_events (session_id);
create index if not exists idx_analytics_events_path       on public.analytics_events (path);

-- The server talks to this table with the service (secret) key, which bypasses RLS, so no
-- policies are needed. Enabling RLS with zero policies keeps the public/anon key from ever
-- reading visitor data if the key were used from the browser.
alter table public.analytics_events enable row level security;
