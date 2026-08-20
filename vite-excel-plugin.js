// Vite plugin: serves the latest Excel file from the project's /excel folder over
// a tiny local API, so the dashboard can auto-load it instead of requiring a manual
// upload. Runs as dev-server middleware (`npm run dev`) and preview-server middleware
// (`npm run preview`) — no separate backend process needed.
//
//   GET /api/excel/meta  -> { found, fileName, mtimeMs, size } | { found: false, error }
//   GET /api/excel/file  -> raw file bytes of the latest file, or 404 { error }
//
// "Latest" = most recent file mtime among .xlsx/.xls files directly inside /excel.
// The same logic backs the production deployment as Vercel serverless functions —
// see api/excel/meta.js, api/excel/file.js, and lib/excelFile.js.
import { handleExcelMeta, handleExcelFile, resolveExcelDir } from "./lib/excelFile.js";

function createMiddleware(excelDir) {
  return function excelFolderMiddleware(req, res, next) {
    if (req.url === "/api/excel/meta") return handleExcelMeta(req, res, excelDir);
    if (req.url === "/api/excel/file") return handleExcelFile(req, res, excelDir);
    next();
  };
}

export function excelFolderPlugin() {
  let excelDir;
  return {
    name: "excel-folder-server",
    configResolved(config) {
      excelDir = resolveExcelDir(config.root);
    },
    configureServer(server) {
      server.middlewares.use(createMiddleware(excelDir));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(excelDir));
    },
  };
}
