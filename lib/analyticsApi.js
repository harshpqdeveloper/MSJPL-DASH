// Request handlers shared by the Vercel serverless functions (api/analytics/*.js) and the
// Vite dev middleware (vite-analytics-plugin.js) — same pattern as lib/excelFile.js.
import { insertEvent, getSummary } from "./analyticsDb.js";
import { parseUserAgent, classifyReferrer } from "./analyticsUA.js";
import { isAdminRequest, checkCredentials, setSessionCookie, clearSessionCookie } from "./analyticsAuth.js";

const MAX_BODY_BYTES = 4096;

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(json);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function normalizePath(raw) {
  if (typeof raw !== "string" || raw.length === 0) return "/";
  const bare = raw.split("?")[0].split("#")[0].slice(0, 300);
  return bare.startsWith("/") ? bare : `/${bare}`;
}

const RANGE_KEYS = ["today", "yesterday", "7d", "30d", "90d", "custom"];
const MAX_CUSTOM_DAYS = 400;

class ValidationError extends Error {}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Day/week/month boundaries are computed in UTC for simplicity — good enough for an
// internal admin dashboard; a per-visitor-timezone "today" is out of scope here.
function resolveRange(range, fromRaw, toRaw) {
  if (!RANGE_KEYS.includes(range)) throw new ValidationError("Invalid range");
  const now = new Date();

  if (range === "custom") {
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new ValidationError("Invalid custom date range");
    }
    const start = startOfUtcDay(from);
    const end = new Date(startOfUtcDay(to).getTime() + 24 * 60 * 60 * 1000);
    if (end <= start) throw new ValidationError("`to` must be on or after `from`");
    if ((end - start) / (24 * 60 * 60 * 1000) > MAX_CUSTOM_DAYS) throw new ValidationError("Custom range too large");
    return { start, end, prevStart: null, prevEnd: null, bucket: "day" };
  }

  let start, end, bucket = "day";
  if (range === "today") { start = startOfUtcDay(now); end = now; bucket = "hour"; }
  else if (range === "yesterday") { end = startOfUtcDay(now); start = new Date(end.getTime() - 24 * 60 * 60 * 1000); bucket = "hour"; }
  else if (range === "7d") { end = now; start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); }
  else if (range === "30d") { end = now; start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); }
  else { end = now; start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000); }

  const span = end - start;
  return { start, end, prevStart: new Date(start.getTime() - span), prevEnd: start, bucket };
}

export async function handleTrack(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 413, { error: "Payload too large" });
  }

  const path = normalizePath(body.path);
  const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 100) : null;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 100) : null;
  if (!visitorId || !sessionId) return sendJson(res, 400, { error: "Missing visitorId/sessionId" });

  const { deviceType, browser, os } = parseUserAgent(req.headers["user-agent"]);
  const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : null);
  const { referrerHost, trafficSource } = classifyReferrer(
    typeof body.referrer === "string" ? body.referrer.slice(0, 500) : "",
    origin
  );

  try {
    await insertEvent({ visitorId, sessionId, path, referrerHost, trafficSource, deviceType, browser, os });
  } catch (e) {
    console.error("[analytics] failed to record event", e);
    // Tracking must never break the visitor's page — swallow the error, still 204.
  }
  res.statusCode = 204;
  res.end();
}

export async function handleLogin(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 413, { error: "Payload too large" });
  }
  let ok;
  try {
    ok = checkCredentials(body.email, body.password);
  } catch (e) {
    console.error("[analytics]", e.message);
    return sendJson(res, 500, { error: "Analytics auth is not configured on the server." });
  }
  if (!ok) return sendJson(res, 401, { error: "Incorrect email or password" });
  setSessionCookie(req, res);
  return sendJson(res, 200, { ok: true });
}

export async function handleLogout(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  clearSessionCookie(req, res);
  return sendJson(res, 200, { ok: true });
}

export async function handleSession(req, res) {
  return sendJson(res, 200, { authenticated: isAdminRequest(req) });
}

export async function handleSummary(req, res) {
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Not authenticated" });

  const url = new URL(req.url, "http://localhost");
  const range = url.searchParams.get("range") || "7d";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let resolved;
  try {
    resolved = resolveRange(range, from, to);
  } catch (e) {
    if (e instanceof ValidationError) return sendJson(res, 400, { error: e.message });
    throw e;
  }

  try {
    const summary = await getSummary(resolved);
    return sendJson(res, 200, { range, from: resolved.start.toISOString(), to: resolved.end.toISOString(), ...summary });
  } catch (e) {
    console.error("[analytics] summary query failed", e);
    return sendJson(res, 500, { error: "Could not load analytics data." });
  }
}
