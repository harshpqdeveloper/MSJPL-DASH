// Vercel serverless function: POST /api/analytics/track
import { handleTrack } from "../../lib/analyticsApi.js";

export default function handler(req, res) {
  return handleTrack(req, res);
}
