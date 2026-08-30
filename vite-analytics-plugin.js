// Vite plugin: mirrors the /api/analytics/* Vercel serverless functions as dev-server
// (and preview-server) middleware, so `npm run dev` behaves the same as production without
// a separate backend process — same pattern as vite-excel-plugin.js / api/excel/*.js.
import { handleTrack, handleLogin, handleLogout, handleSession, handleSummary } from "./lib/analyticsApi.js";

const ROUTES = [
  { method: "POST", url: "/api/analytics/track", handler: handleTrack },
  { method: "POST", url: "/api/analytics/login", handler: handleLogin },
  { method: "POST", url: "/api/analytics/logout", handler: handleLogout },
  { method: "GET", url: "/api/analytics/session", handler: handleSession },
  { method: "GET", url: "/api/analytics/summary", handler: handleSummary },
];

function analyticsMiddleware(req, res, next) {
  const path = req.url.split("?")[0];
  const route = ROUTES.find((r) => r.url === path && r.method === req.method);
  if (!route) return next();
  Promise.resolve(route.handler(req, res)).catch((err) => {
    console.error("[analytics]", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal analytics error" }));
    }
  });
}

export function analyticsApiPlugin() {
  return {
    name: "analytics-api-server",
    configureServer(server) {
      server.middlewares.use(analyticsMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(analyticsMiddleware);
    },
  };
}
