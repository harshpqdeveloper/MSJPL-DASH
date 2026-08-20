// Vercel serverless function: GET /api/excel/meta
// Mirrors the local dev middleware (vite-excel-plugin.js) so the same
// frontend code (src/App.jsx) works unchanged in production.
import { handleExcelMeta, resolveExcelDir } from "../../lib/excelFile.js";

export const config = { includeFiles: "excel/**" };

// Note: on Vercel this can only ever see the bundled excel/ folder (or a path
// reachable from the serverless function) — there is no access to a local
// Windows folder like D:\JemmyData from the cloud. JEMMY_DATA_FOLDER / jemmy.config.json
// only matter for the local npm run dev / npm run preview server (vite-excel-plugin.js).
export default function handler(req, res) {
  const excelDir = resolveExcelDir(process.cwd());
  return handleExcelMeta(req, res, excelDir);
}
