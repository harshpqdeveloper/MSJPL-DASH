// Vercel serverless function: GET /api/excel/file
// Mirrors the local dev middleware (vite-excel-plugin.js) so the same
// frontend code (src/App.jsx) works unchanged in production.
import path from "node:path";
import { handleExcelFile } from "../../lib/excelFile.js";

export const config = { includeFiles: "excel/**" };

export default function handler(req, res) {
  const excelDir = path.join(process.cwd(), "excel");
  return handleExcelFile(req, res, excelDir);
}
