// Vercel serverless function: POST /api/analytics/logout
import { handleLogout } from "../../lib/analyticsApi.js";

export default function handler(req, res) {
  return handleLogout(req, res);
}
