// Vercel serverless function: GET /api/analytics/session
import { handleSession } from "../../lib/analyticsApi.js";

export default function handler(req, res) {
  return handleSession(req, res);
}
