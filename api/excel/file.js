// Vercel serverless function: GET /api/excel/file
// Mirrors the local dev middleware (vite-excel-plugin.js) so the same
// frontend code (src/App.jsx) works unchanged in production.
import { handleExcelFile, resolveExcelDir } from "../../lib/excelFile.js";

export const config = { includeFiles: "excel/**" };

// See the note in api/excel/meta.js about JEMMY_DATA_FOLDER's limits on Vercel.
export default function handler(req, res) {
  const excelDir = resolveExcelDir(process.cwd());
  return handleExcelFile(req, res, excelDir);
}
