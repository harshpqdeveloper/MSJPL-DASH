// Shared logic for finding and serving the latest Excel file from /excel.
// Used by both the Vite dev/preview middleware (vite-excel-plugin.js) and the
// Vercel serverless functions (api/excel/meta.js, api/excel/file.js) so the
// two environments behave identically.
import fs from "node:fs";
import path from "node:path";

export const EXCEL_EXT_RE = /\.(xlsx|xls|xlsm)$/i;
export const NOT_FOUND_MESSAGE = "No Jemmy Excel file found. Please place the latest Excel file in the configured folder.";

// Where to read the Jemmy export from. Checked in order:
//   1. JEMMY_DATA_FOLDER environment variable (e.g. JEMMY_DATA_FOLDER=D:\JemmyData)
//   2. "dataFolder" in jemmy.config.json at the project root (easiest to edit by hand)
//   3. the bundled excel/ folder (unchanged default behavior)
// Relative values in either source are resolved against projectRoot.
export function resolveExcelDir(projectRoot) {
  const fromEnv = process.env.JEMMY_DATA_FOLDER && process.env.JEMMY_DATA_FOLDER.trim();
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(projectRoot, fromEnv);

  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(projectRoot, "jemmy.config.json"), "utf8"));
    const fromCfg = cfg.dataFolder && String(cfg.dataFolder).trim();
    if (fromCfg) return path.isAbsolute(fromCfg) ? fromCfg : path.join(projectRoot, fromCfg);
  } catch {
    // no config file, or invalid JSON -> fall through to the default
  }

  return path.join(projectRoot, "excel");
}

export function listExcelFiles(excelDir) {
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

export function getLatestExcelFile(excelDir) {
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

export function handleExcelMeta(req, res, excelDir) {
  const latest = getLatestExcelFile(excelDir);
  if (!latest) return sendJson(res, 404, { found: false, error: NOT_FOUND_MESSAGE });
  return sendJson(res, 200, { found: true, fileName: latest.name, mtimeMs: latest.mtimeMs, size: latest.size });
}

export function handleExcelFile(req, res, excelDir) {
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
    return sendJson(res, 500, { error: "Unable to read the Jemmy Excel file. Please check the file and try again." });
  }
}
