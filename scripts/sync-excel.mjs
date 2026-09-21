// Excel Auto Sync — keeps Supabase Storage's latest/latest.<ext> in step with the newest
// file in your local excel/ folder, so the Vercel dashboard shows whatever you last saved on
// this PC. Just save a file in excel/ and this uploads it automatically.
//
//   npm run sync           watch the folder and upload on every change (leave it running)
//   npm run sync -- --once  upload the current newest file once, then exit
//
// Uses SUPABASE_URL + SUPABASE_SECRET_KEY from .env (they never leave this machine). The
// Vercel dashboard polls every few seconds, so once a file lands here it refreshes on its own.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { resolveExcelDir, getLatestExcelFile } from "../lib/excelFile.js";

try { process.loadEnvFile(); } catch { /* env may already be set in the real environment */ }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "msjpl-excel";
const POLL_MS = Number(process.env.SYNC_POLL_MS || 8000);
const ONCE = process.argv.includes("--once");

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env — cannot sync. See README.md.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excelDir = resolveExcelDir(projectRoot);

const CONTENT_TYPES = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".xls": "application/vnd.ms-excel",
};

let lastHash = null;   // sha-256 of the file we last uploaded; skip re-uploading identical content
let busy = false;      // guard against overlapping syncs

async function syncOnce() {
  if (busy) return;
  busy = true;
  try {
    const latest = getLatestExcelFile(excelDir);
    if (!latest) {
      console.log(stamp(), "no .xls/.xlsx file in", excelDir, "- nothing to sync yet.");
      return;
    }

    let buffer;
    try {
      buffer = fs.readFileSync(latest.full);
    } catch {
      // Excel may still be writing / holding a lock — the next poll will retry.
      return;
    }

    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    if (hash === lastHash) return; // unchanged content

    const ext = path.extname(latest.name).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/vnd.ms-excel";
    const latestPath = `latest/latest${ext}`;

    // Keep a hashed history copy (idempotent), then overwrite the file the site reads.
    await supabase.storage.from(BUCKET).upload(`daily/${hash}${ext}`, buffer, { upsert: true, contentType });
    const { error } = await supabase.storage.from(BUCKET).upload(latestPath, buffer, { upsert: true, contentType });
    if (error) throw new Error(error.message);

    // Remove the other-extension latest so the server never serves a stale one.
    const other = ext === ".xls" ? ".xlsx" : ".xls";
    await supabase.storage.from(BUCKET).remove([`latest/latest${other}`]).catch(() => {});

    lastHash = hash;
    console.log(stamp(), `uploaded ${latest.name} -> ${BUCKET}/${latestPath} (${buffer.length.toLocaleString()} bytes). Vercel will refresh shortly.`);
  } catch (e) {
    console.error(stamp(), "sync error:", e.message);
  } finally {
    busy = false;
  }
}

function stamp() {
  return new Date().toLocaleTimeString();
}

console.log(`Excel Auto Sync
  watching : ${excelDir}
  uploading: ${SUPABASE_URL}  ->  bucket "${BUCKET}"  ->  latest/latest.<ext>`);

await syncOnce();

if (ONCE) {
  process.exit(0);
}

// Poll on an interval (reliable everywhere), plus react quickly to folder changes.
setInterval(syncOnce, POLL_MS);

let watchTimer = null;
try {
  fs.watch(excelDir, { persistent: true }, () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(syncOnce, 1500);
  });
} catch { /* fs.watch unsupported here — the poll above still covers it */ }

console.log(`Watching for changes (polling every ${Math.round(POLL_MS / 1000)}s). Press Ctrl+C to stop.`);
