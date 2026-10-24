// Dashboard login: who may open the main dashboard (and its /api/excel/* data).
//
//   Admin  — the same email + password as /analytics (ANALYTICS_ADMIN_EMAIL / _PASSWORD env
//            vars). Signing in as admin also opens /analytics, and unlocks /admin, where
//            dashboard users are added, reset and removed.
//   Users  — ID + password pairs created by the admin. Stored as one JSON file in the
//            private Supabase Storage bucket (auth/users.json), passwords scrypt-hashed —
//            no database table or SQL setup needed.
//
// Sessions are HMAC-signed, httpOnly cookies (same secret as the analytics cookie, but a
// different signing domain, so one cookie can never be replayed as the other).
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { checkCredentials, isAdminRequest, parseCookies } from "./analyticsAuth.js";

const COOKIE_NAME = "jd_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const USERS_PATH = "auth/users.json";
const USERS_CACHE_MS = 30 * 1000; // a removed user / reset password takes effect within 30s

export const USERNAME_RE = /^[a-z0-9._@-]{3,40}$/;
export const MIN_PASSWORD = 6;

// ---------------------------------------------------------------------------------------
// Users store (Supabase Storage)
// ---------------------------------------------------------------------------------------

let cachedClient = null;

// Env read at call time, not import time — Vite injects .env after this module loads.
function getSupabase() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing (SUPABASE_URL / SUPABASE_SECRET_KEY).");
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

const bucket = () => process.env.SUPABASE_BUCKET || "msjpl-excel";

let usersCache = null; // { users, at }

export async function loadUsers({ fresh = false } = {}) {
  if (!fresh && usersCache && Date.now() - usersCache.at < USERS_CACHE_MS) return usersCache.users;
  const { data, error } = await getSupabase().storage.from(bucket()).download(USERS_PATH);
  let users = [];
  if (error) {
    // No file yet = no users yet. Anything else is a real failure.
    const notFound = /not.?found|does not exist|404/i.test(`${error.message} ${error.statusCode || ""} ${error.status || ""}`);
    if (!notFound) throw new Error(`Could not read users: ${error.message}`);
  } else {
    const json = JSON.parse(await data.text());
    users = Array.isArray(json.users) ? json.users : [];
  }
  usersCache = { users, at: Date.now() };
  return users;
}

async function saveUsers(users) {
  const body = JSON.stringify({ users }, null, 2);
  const { error } = await getSupabase().storage.from(bucket())
    .upload(USERS_PATH, body, { upsert: true, contentType: "application/json", cacheControl: "0" });
  if (error) throw new Error(`Could not save users: ${error.message}`);
  usersCache = { users, at: Date.now() };
}

// ---------------------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------------------

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function passwordMatches(password, user) {
  const a = Buffer.from(hashPassword(password, user.salt), "hex");
  const b = Buffer.from(user.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 10 characters, no look-alikes (0/O, 1/l/I), easy to read out over the phone.
const PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export function generatePassword(length = 10) {
  let out = "";
  for (let i = 0; i < length; i++) out += PW_ALPHABET[crypto.randomInt(PW_ALPHABET.length)];
  return out;
}

function credentialRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  // `v` changes on every password reset, which invalidates that user's existing sessions.
  return { salt, hash: hashPassword(password, salt), v: crypto.randomBytes(6).toString("hex") };
}

export const normalizeUsername = (u) => String(u || "").trim().toLowerCase();

const adminEmail = () => normalizeUsername(process.env.ANALYTICS_ADMIN_EMAIL);

// ---------------------------------------------------------------------------------------
// User management (admin only — callers check that first)
// ---------------------------------------------------------------------------------------

export class UserError extends Error {}

export async function listUsers() {
  const users = await loadUsers({ fresh: true });
  return users.map((u) => ({ username: u.username, createdAt: u.createdAt, passwordSetAt: u.passwordSetAt || u.createdAt }));
}

export async function createUser(rawUsername, rawPassword) {
  const username = normalizeUsername(rawUsername);
  if (!USERNAME_RE.test(username)) throw new UserError("ID must be 3–40 characters: letters, numbers, . _ - @");
  if (username === adminEmail()) throw new UserError("That ID is the admin login.");
  const password = rawPassword ? String(rawPassword) : generatePassword();
  if (password.length < MIN_PASSWORD) throw new UserError(`Password must be at least ${MIN_PASSWORD} characters.`);

  const users = await loadUsers({ fresh: true });
  if (users.some((u) => u.username === username)) throw new UserError("A user with this ID already exists.");
  const now = new Date().toISOString();
  await saveUsers([...users, { username, ...credentialRecord(password), createdAt: now, passwordSetAt: now }]);
  return { username, password };
}

export async function resetPassword(rawUsername, rawPassword) {
  const username = normalizeUsername(rawUsername);
  const password = rawPassword ? String(rawPassword) : generatePassword();
  if (password.length < MIN_PASSWORD) throw new UserError(`Password must be at least ${MIN_PASSWORD} characters.`);
  const users = await loadUsers({ fresh: true });
  const user = users.find((u) => u.username === username);
  if (!user) throw new UserError("No user with this ID.");
  const next = users.map((u) => (u === user ? { ...u, ...credentialRecord(password), passwordSetAt: new Date().toISOString() } : u));
  await saveUsers(next);
  return { username, password };
}

export async function deleteUser(rawUsername) {
  const username = normalizeUsername(rawUsername);
  const users = await loadUsers({ fresh: true });
  if (!users.some((u) => u.username === username)) throw new UserError("No user with this ID.");
  await saveUsers(users.filter((u) => u.username !== username));
}

// ---------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------

function getSecret() {
  const secret = process.env.ANALYTICS_SESSION_SECRET;
  if (!secret) throw new Error("ANALYTICS_SESSION_SECRET is not set — see README.md.");
  return secret;
}

const sign = (body) => crypto.createHmac("sha256", getSecret()).update(`jd-dashboard:${body}`).digest("base64url");

function createToken(claims) {
  const body = Buffer.from(JSON.stringify({ ...claims, exp: Date.now() + SESSION_TTL_MS }), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function readToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof claims.exp === "number" && Date.now() < claims.exp ? claims : null;
  } catch {
    return null;
  }
}

// Secure only over real HTTPS (Vercel sets x-forwarded-proto) — a Secure cookie would be
// silently dropped on the plain-http LAN server, leaving users stuck at the login page.
function isHttps(req) {
  return req.headers["x-forwarded-proto"] === "https" || Boolean(req.socket?.encrypted);
}

function cookie(req, value, maxAgeSec) {
  const attrs = [`${COOKIE_NAME}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  if (isHttps(req)) attrs.push("Secure");
  return attrs.join("; ");
}

// Appends rather than overwrites, so it can sit alongside the /analytics admin cookie.
function appendSetCookie(res, value) {
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", prev ? [...(Array.isArray(prev) ? prev : [prev]), value] : value);
}

export function setUserSessionCookie(req, res, claims) {
  appendSetCookie(res, cookie(req, createToken(claims), Math.floor(SESSION_TTL_MS / 1000)));
}

export function clearUserSessionCookie(req, res) {
  appendSetCookie(res, cookie(req, "", 0));
}

// Who is signed in: { username, isAdmin } or null. A user's session dies as soon as they are
// deleted or their password is reset (checked against the users store, cached 30s).
export async function getSessionUser(req) {
  const claims = readToken(parseCookies(req)[COOKIE_NAME]);
  if (claims?.r === "admin") return { username: claims.u, isAdmin: true };
  if (claims?.r === "user") {
    const user = (await loadUsers()).find((u) => u.username === claims.u);
    if (user && user.v === claims.v) return { username: user.username, isAdmin: false };
  }
  // Signed in on /analytics only — the admin is the admin either way.
  if (isAdminRequest(req)) return { username: adminEmail(), isAdmin: true };
  return null;
}

// Returns the session claims for a correct ID + password, or null.
export async function verifyLogin(rawUsername, password) {
  const username = normalizeUsername(rawUsername);
  if (!username || !password) return null;
  let isAdmin = false;
  try { isAdmin = checkCredentials(username, password); } catch { /* admin env not set — users can still sign in */ }
  if (isAdmin) return { u: username, r: "admin" };
  const user = (await loadUsers({ fresh: true })).find((u) => u.username === username);
  if (user && passwordMatches(password, user)) return { u: user.username, r: "user", v: user.v };
  return null;
}
