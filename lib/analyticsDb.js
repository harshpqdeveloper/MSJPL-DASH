// Shared analytics DB access — backed by Supabase (PostgREST via @supabase/supabase-js),
// used the same way from the Vite dev middleware (vite-analytics-plugin.js) and the Vercel
// serverless functions (api/analytics/*.js). Mirrors the Supabase usage in lib/excelFile.js,
// so the whole app talks to one backend.
//
// The analytics_events table + indexes are created once by running
// supabase/analytics-setup.sql in the Supabase SQL editor (Supabase's JS client can't run
// DDL). The summary is aggregated in JS after a paginated fetch — simple and correct for an
// internal, low-traffic dashboard; move it into a Postgres RPC if the table ever grows large.
import { createClient } from "@supabase/supabase-js";

const TABLE = "analytics_events";

let cachedClient = null;

// Lazily created — and the env vars are read here, at call time, NOT at module top level.
// Vite's dev/preview server injects .env into process.env inside the config callback, which
// runs *after* this module is first imported, so a top-level capture would read `undefined`.
// The secret (service) key bypasses RLS, so server-side inserts/reads need no table policies.
function getSupabase() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing (SUPABASE_URL / SUPABASE_SECRET_KEY) — see README.md's Visitor analytics section."
    );
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

export async function insertEvent({ visitorId, sessionId, path, referrerHost, trafficSource, deviceType, browser, os }) {
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).insert({
    visitor_id: visitorId,
    session_id: sessionId,
    path,
    referrer_host: referrerHost,
    traffic_source: trafficSource,
    device_type: deviceType,
    browser,
    os,
  });
  if (error) throw new Error(error.message);
}

const ACTIVE_WINDOW_MINUTES = 5;
const PAGE_SIZE = 1000; // Supabase/PostgREST returns at most 1000 rows per request.
const MAX_PAGES = 500; // Safety cap (500k rows) so a huge table can't hang a request.

// Pull every event once (paginated, only the columns the summary needs) and aggregate in JS.
// Fine for an internal dashboard; the created_at is parsed to a numeric ms timestamp (`t`)
// once here so the per-metric filters below stay cheap.
async function fetchAllEvents() {
  const supabase = getSupabase();
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from(TABLE)
      .select("created_at, visitor_id, path, traffic_source, device_type, browser, os")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const r of data) rows.push({ ...r, t: Date.parse(r.created_at) });
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

// [a, b) by numeric ms timestamp; b may be Infinity for an open-ended ">= a" window.
function inWindow(rows, a, b) {
  return rows.filter((r) => r.t >= a && r.t < b);
}

function distinctCount(rows, field) {
  const seen = new Set();
  for (const r of rows) seen.add(r[field]);
  return seen.size;
}

// GROUP BY <field> ORDER BY count DESC — matches the neon queries this replaced.
function groupCount(rows, field) {
  const counts = new Map();
  for (const r of rows) {
    const key = r[field] ?? "Other";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n);
}

// Truncate a ms timestamp to the start of its UTC hour/day (mirrors SQL date_trunc in UTC).
function truncUtc(t, bucket) {
  const d = new Date(t);
  return bucket === "hour"
    ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours())
    : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function buildTrend(rows, bucket) {
  const buckets = new Map();
  for (const r of rows) {
    const key = truncUtc(r.t, bucket);
    let e = buckets.get(key);
    if (!e) { e = { visits: 0, visitors: new Set() }; buckets.set(key, e); }
    e.visits += 1;
    e.visitors.add(r.visitor_id);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, e]) => ({ bucket: new Date(k).toISOString(), visitors: e.visitors.size, visits: e.visits }));
}

function buildTopPages(rows, limit = 10) {
  const pages = new Map();
  for (const r of rows) {
    let e = pages.get(r.path);
    if (!e) { e = { path: r.path, visits: 0, visitors: new Set() }; pages.set(r.path, e); }
    e.visits += 1;
    e.visitors.add(r.visitor_id);
  }
  return [...pages.values()]
    .map((e) => ({ path: e.path, visits: e.visits, visitors: e.visitors.size }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, limit);
}

// `start`/`end` are Date objects: events counted are [start, end). `bucket` is 'hour' or
// 'day', used to group the trend chart. `prevStart`/`prevEnd` are the equal-length preceding
// window, or null when no reliable comparison exists (custom range).
export async function getSummary({ start, end, bucket, prevStart, prevEnd }) {
  const all = await fetchAllEvents();

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const dayAgo = now - DAY;
  const twoDayAgo = now - 2 * DAY;
  const sevenAgo = now - 7 * DAY;
  const fourteenAgo = now - 14 * DAY;
  const thirtyAgo = now - 30 * DAY;
  const sixtyAgo = now - 60 * DAY;
  const activeSince = now - ACTIVE_WINDOW_MINUTES * 60 * 1000;

  const rangeRows = inWindow(all, start.getTime(), end.getTime());
  const visitorsIn = (a, b) => distinctCount(inWindow(all, a, b), "visitor_id");

  return {
    totalVisitors: distinctCount(all, "visitor_id"),
    totalVisits: all.length,
    visitorsToday: visitorsIn(dayAgo, Infinity),
    visitorsPrevDay: visitorsIn(twoDayAgo, dayAgo),
    visitors7d: visitorsIn(sevenAgo, Infinity),
    visitorsPrev7d: visitorsIn(fourteenAgo, sevenAgo),
    visitors30d: visitorsIn(thirtyAgo, Infinity),
    visitorsPrev30d: visitorsIn(sixtyAgo, thirtyAgo),
    rangeVisitors: distinctCount(rangeRows, "visitor_id"),
    rangeVisits: rangeRows.length,
    prevRangeVisitors: prevStart && prevEnd ? visitorsIn(prevStart.getTime(), prevEnd.getTime()) : null,
    trend: buildTrend(rangeRows, bucket),
    devices: groupCount(rangeRows, "device_type"),
    browsers: groupCount(rangeRows, "browser"),
    os: groupCount(rangeRows, "os"),
    topPages: buildTopPages(rangeRows),
    sources: groupCount(rangeRows, "traffic_source"),
    activeNow: visitorsIn(activeSince, Infinity),
    bucket,
  };
}
