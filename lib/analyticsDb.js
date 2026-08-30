// Shared analytics DB access — Neon (Vercel Postgres) serverless driver, used the same
// way from the Vite dev middleware (vite-analytics-plugin.js) and the Vercel serverless
// functions (api/analytics/*.js). Mirrors the shared-logic pattern in lib/excelFile.js.
import { neon } from "@neondatabase/serverless";

// Run once via `npm run db:migrate` (scripts/migrate-analytics.mjs) — not on the hot
// request path. The neon() one-shot function can't run a multi-statement raw SQL string
// (no sessions), so this issues each statement as its own tagged-template call, batched
// atomically via sql.transaction(). See scripts/migrate-analytics.mjs for how `sql` is created.
export async function runMigration(sql) {
  await sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      visitor_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      path TEXT NOT NULL,
      referrer_host TEXT,
      traffic_source TEXT NOT NULL DEFAULT 'direct',
      device_type TEXT NOT NULL DEFAULT 'desktop',
      browser TEXT NOT NULL DEFAULT 'Other',
      os TEXT NOT NULL DEFAULT 'Other'
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id ON analytics_events (visitor_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events (session_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_path ON analytics_events (path)`,
  ]);
}

let cachedSql = null;

// Lazily created so importing this module never throws when POSTGRES_URL isn't set yet
// (e.g. during `npm run build`, which doesn't need a live DB connection).
function getSql() {
  if (cachedSql) return cachedSql;
  const connectionString =
    process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error(
      "No Postgres connection string found. Set DATABASE_URL (or POSTGRES_URL) — see README.md's Visitor analytics section."
    );
  }
  cachedSql = neon(connectionString);
  return cachedSql;
}

export async function insertEvent({ visitorId, sessionId, path, referrerHost, trafficSource, deviceType, browser, os }) {
  const sql = getSql();
  await sql`
    INSERT INTO analytics_events (visitor_id, session_id, path, referrer_host, traffic_source, device_type, browser, os)
    VALUES (${visitorId}, ${sessionId}, ${path}, ${referrerHost}, ${trafficSource}, ${deviceType}, ${browser}, ${os})
  `;
}

const ACTIVE_WINDOW_MINUTES = 5;

// `start`/`end` are Date objects: events counted are [start, end). `bucket` is
// 'hour' or 'day', used to group the trend chart. `prevStart`/`prevEnd` are the
// equal-length preceding window, or null when no reliable comparison exists (custom range).
export async function getSummary({ start, end, bucket, prevStart, prevEnd }) {
  const sql = getSql();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MINUTES * 60 * 1000);

  const [
    totalVisitorsRow, totalVisitsRow,
    visitorsTodayRow, visitorsPrevDayRow,
    visitors7dRow, visitorsPrev7dRow,
    visitors30dRow, visitorsPrev30dRow,
    rangeVisitorsRow, rangeVisitsRow,
    prevRangeVisitorsRow,
    trendRows, deviceRows, browserRows, osRows, topPagesRows, sourceRows,
    activeNowRow,
  ] = await Promise.all([
    sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events`,
    sql`SELECT COUNT(*)::int AS n FROM analytics_events`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events WHERE created_at >= ${dayAgo}`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events WHERE created_at >= ${new Date(dayAgo.getTime() - 24 * 60 * 60 * 1000)} AND created_at < ${dayAgo}`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events WHERE created_at >= ${sevenAgo}`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events WHERE created_at >= ${fourteenAgo} AND created_at < ${sevenAgo}`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events WHERE created_at >= ${thirtyAgo}`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events WHERE created_at >= ${sixtyAgo} AND created_at < ${thirtyAgo}`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events WHERE created_at >= ${start} AND created_at < ${end}`,
    sql`SELECT COUNT(*)::int AS n FROM analytics_events WHERE created_at >= ${start} AND created_at < ${end}`,
    prevStart && prevEnd
      ? sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events WHERE created_at >= ${prevStart} AND created_at < ${prevEnd}`
      : Promise.resolve([{ n: null }]),
    bucket === "hour"
      ? sql`SELECT date_trunc('hour', created_at) AS bucket, COUNT(DISTINCT visitor_id)::int AS visitors, COUNT(*)::int AS visits
            FROM analytics_events WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 1 ORDER BY 1`
      : sql`SELECT date_trunc('day', created_at) AS bucket, COUNT(DISTINCT visitor_id)::int AS visitors, COUNT(*)::int AS visits
            FROM analytics_events WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 1 ORDER BY 1`,
    sql`SELECT device_type AS name, COUNT(*)::int AS n FROM analytics_events WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT browser AS name, COUNT(*)::int AS n FROM analytics_events WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT os AS name, COUNT(*)::int AS n FROM analytics_events WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT path, COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors
        FROM analytics_events WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    sql`SELECT traffic_source AS name, COUNT(*)::int AS n FROM analytics_events WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM analytics_events WHERE created_at >= ${activeSince}`,
  ]);

  return {
    totalVisitors: totalVisitorsRow[0].n,
    totalVisits: totalVisitsRow[0].n,
    visitorsToday: visitorsTodayRow[0].n,
    visitorsPrevDay: visitorsPrevDayRow[0].n,
    visitors7d: visitors7dRow[0].n,
    visitorsPrev7d: visitorsPrev7dRow[0].n,
    visitors30d: visitors30dRow[0].n,
    visitorsPrev30d: visitorsPrev30dRow[0].n,
    rangeVisitors: rangeVisitorsRow[0].n,
    rangeVisits: rangeVisitsRow[0].n,
    prevRangeVisitors: prevRangeVisitorsRow[0].n,
    trend: trendRows.map((r) => ({ bucket: r.bucket, visitors: r.visitors, visits: r.visits })),
    devices: deviceRows,
    browsers: browserRows,
    os: osRows,
    topPages: topPagesRows,
    sources: sourceRows,
    activeNow: activeNowRow[0].n,
  };
}
