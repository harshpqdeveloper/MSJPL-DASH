// Vite plugin: mirrors the /api/auth/<action> Vercel function (api/auth/[action].js) as
// dev-server and preview-server middleware — same pattern as vite-analytics-plugin.js.
import { handleAuth } from "./lib/authApi.js";

function authMiddleware(req, res, next) {
  const match = req.url.split("?")[0].match(/^\/api\/auth\/([a-z]+)\/?$/);
  if (!match) return next();
  handleAuth(req, res, match[1]);
}

export function authApiPlugin() {
  return {
    name: "auth-api-server",
    configureServer(server) {
      server.middlewares.use(authMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(authMiddleware);
    },
  };
}
