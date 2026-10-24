// /api/auth/<action> handlers, shared by the Vercel function (api/auth/[action].js) and the
// Vite dev/preview middleware (vite-auth-plugin.js) — same pattern as lib/analyticsApi.js.
//
//   POST /api/auth/login    { username, password }  -> signs in (admin or dashboard user)
//   POST /api/auth/logout                           -> signs out of the dashboard and /analytics
//   GET  /api/auth/session                          -> { authenticated, username, isAdmin }
//   GET    /api/auth/users                          -> admin: list users
//   POST   /api/auth/users  { username, password? } -> admin: add user (password generated if blank)
//   PATCH  /api/auth/users  { username, password? } -> admin: reset password
//   DELETE /api/auth/users  { username }            -> admin: remove user
import { sendJson, readJsonBody } from "./analyticsApi.js";
import { insertLogin } from "./analyticsDb.js";
import { parseUserAgent } from "./analyticsUA.js";
import { setSessionCookie as setAdminCookie, clearSessionCookie as clearAdminCookie } from "./analyticsAuth.js";
import {
  getSessionUser, verifyLogin, setUserSessionCookie, clearUserSessionCookie,
  listUsers, createUser, resetPassword, deleteUser, UserError,
} from "./userAuth.js";

const FAILED_LOGIN_DELAY_MS = 600; // slows down password guessing

async function body(req, res) {
  try {
    return await readJsonBody(req);
  } catch {
    sendJson(res, 413, { error: "Payload too large" });
    return null;
  }
}

async function handleLogin(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  const b = await body(req, res);
  if (!b) return;
  let claims;
  try {
    claims = await verifyLogin(b.username, b.password);
  } catch (e) {
    console.error("[auth] login failed", e);
    return sendJson(res, 500, { error: "Login is not available right now. Please try again." });
  }
  if (!claims) {
    await new Promise((r) => setTimeout(r, FAILED_LOGIN_DELAY_MS));
    return sendJson(res, 401, { error: "Incorrect ID or password" });
  }
  // The admin gets the /analytics cookie too, so one sign-in opens everything.
  if (claims.r === "admin") setAdminCookie(req, res);
  setUserSessionCookie(req, res, claims);

  // Login history for /analytics → User activity. Never blocks or fails the sign-in.
  try {
    const { deviceType, browser, os } = parseUserAgent(req.headers["user-agent"]);
    await insertLogin({ username: claims.u, isAdmin: claims.r === "admin", deviceType, browser, os });
  } catch (e) {
    console.error("[auth] could not record login", e);
  }

  return sendJson(res, 200, { authenticated: true, username: claims.u, isAdmin: claims.r === "admin" });
}

async function handleLogout(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  clearAdminCookie(req, res);
  clearUserSessionCookie(req, res);
  return sendJson(res, 200, { ok: true });
}

async function handleSession(req, res) {
  const user = await getSessionUser(req);
  return sendJson(res, 200, user ? { authenticated: true, ...user } : { authenticated: false });
}

async function handleUsers(req, res) {
  const me = await getSessionUser(req);
  if (!me) return sendJson(res, 401, { error: "Not signed in" });
  if (!me.isAdmin) return sendJson(res, 403, { error: "Admin only" });

  try {
    if (req.method === "GET") return sendJson(res, 200, { users: await listUsers() });
    const b = await body(req, res);
    if (!b) return;
    if (req.method === "POST") return sendJson(res, 200, await createUser(b.username, b.password));
    if (req.method === "PATCH") return sendJson(res, 200, await resetPassword(b.username, b.password));
    if (req.method === "DELETE") { await deleteUser(b.username); return sendJson(res, 200, { ok: true }); }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (e) {
    if (e instanceof UserError) return sendJson(res, 400, { error: e.message });
    console.error("[auth] users", e);
    return sendJson(res, 500, { error: "Could not update users. Please try again." });
  }
}

const ACTIONS = { login: handleLogin, logout: handleLogout, session: handleSession, users: handleUsers };

export async function handleAuth(req, res, action) {
  const handler = ACTIONS[action];
  if (!handler) return sendJson(res, 404, { error: "Not found" });
  try {
    return await handler(req, res);
  } catch (e) {
    console.error("[auth]", e);
    if (!res.headersSent) sendJson(res, 500, { error: "Internal error" });
  }
}
