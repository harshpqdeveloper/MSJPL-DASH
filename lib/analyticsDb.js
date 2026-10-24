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
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing (SUPABASE_URL / SUPABASE_SECRET_KEY) — see README.md's Visitor analytics section."
    );
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

// True when Supabase says a column/table doesn't exist yet — i.e. user-activity-setup.sql
// hasn't been run. Everything degrades to the old anonymous behavior until it is.
const isMissingSchema = (error) =>
  /does not exist|schema cache|could not find/i.test(error?.message || "") || ["42703", "42P01", "PGRST204", "PGRST205"].includes(error?.code);

export async function insertEvent({ visitorId, sessionId, path, referrerHost, trafficSource, deviceType, browser, os, username }) {
  const supabase = getSupabase();
  const row = {
    visitor_id: visitorId,
    session_id: sessionId,
    path,
    referrer_host: referrerHost,
    traffic_source: trafficSource,
    device_type: deviceType,
    browser,
    os,
  };
  let { error } = await supabase.from(TABLE).insert(username ? { ...row, username } : row);
  if (error && username && isMissingSchema(error)) ({ error } = await supabase.from(TABLE).insert(row));
  if (error) throw new Error(error.message);
}

const LOGINS_TABLE = "auth_logins";

export async function insertLogin({ username, isAdmin, deviceType, browser, os }) {
  const { error } = await getSupabase().from(LOGINS_TABLE)
    .insert({ username, is_admin: Boolean(isAdmin), device_type: deviceType, browser, os });
  if (error && !isMissingSchema(error)) throw new Error(error.message);
}

const ACTIVE_WINDOW_MINUTES = 5;
const PAGE_SIZE = 1000; // Supabase/PostgREST returns at most 1000 rows per request.
const MAX_PAGES = 500; // Safety cap (500k rows) so a huge table can't hang a request.

// Paginated full read of one table (only `columns`), oldest first, each row given a numeric
// ms timestamp `t`. Returns null when the table/column doesn't exist yet.
async function fetchAll(table, columns) {
  const supabase = getSupabase();
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (isMissingSchema(error)) return null;
      throw new Error(error.message);
    }
    if (!data || data.length === 0) break;
    for (const r of data) rows.push({ ...r, t: Date.parse(r.created_at) });
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

// Pull every event once and aggregate in JS — fine for an internal dashboard. Falls back to
// the pre-login columns if the `username` column hasn't been added yet.
async function fetchAllEvents() {
  const base = "created_at, visitor_id, path, traffic_source, device_type, browser, os";
  const withUser = await fetchAll(TABLE, `${base}, username`);
  if (withUser) return { rows: withUser, hasUsername: true };
  const rows = await fetchAll(TABLE, base);
  if (!rows) throw new Error(`Table ${TABLE} is missing — run supabase/analytics-setup.sql.`);
  return { rows, hasUsername: false };
}

// Per-user activity: logins and dashboard visits in the selected range, plus each user's
// all-time last login / last visit. `knownUsers` (IDs from the users list) also get a row
// when they have no activity, so "never signed in" is visible too.
function buildUserActivity(events, logins, start, end, knownUsers) {
  const users = new Map();
  const get = (name) => {
    let u = users.get(name);
    if (!u) {
      u = { username: name, isAdmin: false, logins: 0, visits: 0, lastLogin: null, lastVisit: null, lastDevice: null };
      users.set(name, u);
    }
    return u;
  };
  for (const name of knownUsers) get(name);
  for (const l of logins) {
    const u = get(l.username);
    if (l.is_admin) u.isAdmin = true;
    if (l.t >= start && l.t < end) u.logins += 1;
    if (!u.lastLogin || l.t > Date.parse(u.lastLogin)) { u.lastLogin = l.created_at; u.lastDevice = `${l.browser} · ${l.os}`; }
  }
  for (const e of events) {
    if (!e.username) continue;
    const u = get(e.username);
    if (e.t >= start && e.t < end) u.visits += 1;
    if (!u.lastVisit || e.t > Date.parse(u.lastVisit)) u.lastVisit = e.created_at;
  }
  const last = (u) => Math.max(Date.parse(u.lastLogin || 0) || 0, Date.parse(u.lastVisit || 0) || 0);
  return [...users.values()].sort((a, b) => last(b) - last(a) || a.username.localeCompare(b.username));
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
export async function getSummary({ start, end, bucket, prevStart, prevEnd }, knownUsers = []) {
  const [{ rows: all, hasUsername }, logins] = await Promise.all([
    fetchAllEvents(),
    fetchAll(LOGINS_TABLE, "created_at, username, is_admin, device_type, browser, os"),
  ]);
  const userTrackingReady = hasUsername && logins !== null;
  const loginsInRange = (logins || []).filter((l) => l.t >= start.getTime() && l.t < end.getTime());

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
    userTrackingReady,
    userActivity: userTrackingReady ? buildUserActivity(all, logins, start.getTime(), end.getTime(), knownUsers) : [],
    recentLogins: loginsInRange.slice(-100).reverse()
      .map((l) => ({ at: l.created_at, username: l.username, isAdmin: l.is_admin, device: `${l.browser} · ${l.os}`, deviceType: l.device_type })),
  };
}
