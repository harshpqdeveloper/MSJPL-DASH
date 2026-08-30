// Vercel serverless function: GET /api/analytics/summary (admin session cookie required)
import { handleSummary } from "../../lib/analyticsApi.js";

export default function handler(req, res) {
  return handleSummary(req, res);
}
