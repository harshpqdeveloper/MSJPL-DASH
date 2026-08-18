# excel/

Drop the production WIP export here as `.xlsx` or `.xls`.

- The dashboard automatically uses whichever file has the most recent modification time.
- Locally (`npm run dev`/`preview`), just add a new file or overwrite an existing one — no restart needed.
- This folder IS committed to git (unlike a typical data folder) — the Excel file itself is what the
  Vercel deployment serves via `api/excel/meta.js` / `api/excel/file.js`. To update the live dashboard,
  overwrite the file here and `git push` — Vercel auto-redeploys with the new data.
- Keep only one file here; only the newest (by modification time) is used, and Vercel deploys don't
  reliably preserve relative mtimes across multiple files.
