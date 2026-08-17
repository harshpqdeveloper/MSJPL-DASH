// Vite plugin: serves the latest Excel file from the project's /excel folder over
// a tiny local API, so the dashboard can auto-load it instead of requiring a manual
// upload. Runs as dev-server middleware (`npm run dev`) and preview-server middleware
// (`npm run preview`) — no separate backend process needed.
//
//   GET /api/excel/meta  -> { found, fileName, mtimeMs, size } | { found: false, error }
//   GET /api/excel/file  -> raw file bytes of the latest file, or 404 { error }
//
// "Latest" = most recent file mtime among .xlsx/.xls files directly inside /excel.
import fs from "node:fs";
import path from "node:path";

const EXCEL_EXT_RE = /\.(xlsx|xls)$/i;
const NOT_FOUND_MESSAGE = "No Excel file found. Please place an Excel file inside the excel folder.";

function listExcelFiles(excelDir) {
  let entries;
  try {
    entries = fs.readdirSync(excelDir, { withFileTypes: true });
  } catch {
    return []; // folder missing entirely — treat the same as "no files"
  }
  return entries
    .filter((e) => e.isFile() && EXCEL_EXT_RE.test(e.name) && !e.name.startsWith("~$")) // skip Excel's own lock files
    .map((e) => {
      const full = path.join(excelDir, e.name);
      const stat = fs.statSync(full);
      return { name: e.name, full, mtimeMs: stat.mtimeMs, size: stat.size };
    });
}

function getLatestExcelFile(excelDir) {
  const files = listExcelFiles(excelDir);
  if (files.length === 0) return null;
  return files.reduce((latest, f) => (f.mtimeMs > latest.mtimeMs ? f : latest));
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(json);
}

function createMiddleware(excelDir) {
  return function excelFolderMiddleware(req, res, next) {
    if (req.url === "/api/excel/meta") {
      const latest = getLatestExcelFile(excelDir);
      if (!latest) return sendJson(res, 404, { found: false, error: NOT_FOUND_MESSAGE });
      return sendJson(res, 200, { found: true, fileName: latest.name, mtimeMs: latest.mtimeMs, size: latest.size });
    }

    if (req.url === "/api/excel/file") {
      const latest = getLatestExcelFile(excelDir);
      if (!latest) return sendJson(res, 404, { error: NOT_FOUND_MESSAGE });
      try {
        const buf = fs.readFileSync(latest.full);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Excel-Filename", encodeURIComponent(latest.name));
        res.setHeader("X-Excel-Mtime", String(latest.mtimeMs));
        return res.end(buf);
      } catch {
        return sendJson(res, 500, { error: "Could not read the Excel file. It may be open in another program or corrupted." });
      }
    }

    next();
  };
}

export function excelFolderPlugin() {
  let excelDir;
  return {
    name: "excel-folder-server",
    configResolved(config) {
      excelDir = path.resolve(config.root, "excel");
    },
    configureServer(server) {
      server.middlewares.use(createMiddleware(excelDir));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(excelDir));
    },
  };
}
