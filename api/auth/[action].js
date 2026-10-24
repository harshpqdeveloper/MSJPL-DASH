// Vercel serverless function: /api/auth/login | logout | session | users
// One dynamic function for all of them keeps the project under Vercel's function limit.
import { handleAuth } from "../../lib/authApi.js";

export default function handler(req, res) {
  return handleAuth(req, res, req.query.action);
}
