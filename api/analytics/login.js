// Vercel serverless function: POST /api/analytics/login
import { handleLogin } from "../../lib/analyticsApi.js";

export default function handler(req, res) {
  return handleLogin(req, res);
}
