// Admin auth for the /analytics page: a single email+password pair (env vars) protected by
// an HMAC-signed, httpOnly session cookie. No accounts, no external auth provider —
// deliberately as simple as a "real" server-side check can be, per the user's choice.
import crypto from "node:crypto";

const COOKIE_NAME = "jd_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSecret() {
  const secret = process.env.ANALYTICS_SESSION_SECRET;
  if (!secret) throw new Error("ANALYTICS_SESSION_SECRET is not set — see README.md's Visitor analytics section.");
  return secret;
}

function sign(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionToken() {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const body = Buffer.from(payload, "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}

// Constant-time-ish equality: padding to equal length keeps timingSafeEqual from throwing;
// a length mismatch alone leaks negligible information compared to a full early-return.
function secureEquals(candidate, expected) {
  const a = Buffer.from(String(candidate || ""));
  const b = Buffer.from(String(expected || ""));
  const padded = Buffer.alloc(b.length);
  a.copy(padded);
  return a.length === b.length && crypto.timingSafeEqual(padded, b);
}

export function checkCredentials(email, password) {
  const expectedEmail = process.env.ANALYTICS_ADMIN_EMAIL;
  const expectedPassword = process.env.ANALYTICS_ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) {
    throw new Error("ANALYTICS_ADMIN_EMAIL / ANALYTICS_ADMIN_PASSWORD are not set — see README.md's Visitor analytics section.");
  }
  const emailOk = secureEquals(String(email || "").trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordOk = secureEquals(password, expectedPassword);
  return emailOk && passwordOk;
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function isHttps(req) {
  return process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
}

export function setSessionCookie(req, res) {
  const token = createSessionToken();
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps(req)) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function clearSessionCookie(req, res) {
  const attrs = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isHttps(req)) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function isAdminRequest(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[COOKIE_NAME]);
}
