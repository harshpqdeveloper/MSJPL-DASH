// Shared Excel serving logic.
//
// LOCAL:
//   Reads Excel from the local /excel folder.
//
// VERCEL:
//   Reads the latest Excel from Supabase Storage:
//
//   msjpl-excel
//      └── latest
//           └── latest.xls
//
// The API response format remains compatible with the existing
// frontend/dashboard.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export const EXCEL_EXT_RE = /\.(xlsx|xls|xlsm)$/i;

export const NOT_FOUND_MESSAGE =
  "No Jemmy Excel file found.";

/*
|--------------------------------------------------------------------------
| Supabase configuration
|--------------------------------------------------------------------------
*/

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPABASE_BUCKET =
  process.env.SUPABASE_BUCKET ||
  "msjpl-excel";

const SUPABASE_LATEST_XLS =
  "latest/latest.xls";

const SUPABASE_LATEST_XLSX =
  "latest/latest.xlsx";

/*
|--------------------------------------------------------------------------
| Supabase client
|--------------------------------------------------------------------------
*/

function getSupabaseClient() {

  if (
    !SUPABASE_URL ||
    !SUPABASE_SECRET_KEY
  ) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY
  );
}

/*
|--------------------------------------------------------------------------
| Decide whether Supabase should be used
|--------------------------------------------------------------------------
|
| On Vercel:
|   VERCEL=1
|
| On local development:
|   use local Excel folder.
|
|--------------------------------------------------------------------------
*/

export function isVercelEnvironment() {

  return (
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV
  );
}

/*
|--------------------------------------------------------------------------
| Existing local folder resolver
|--------------------------------------------------------------------------
|
| Keep this because local npm run dev should continue working.
|--------------------------------------------------------------------------
*/

export function resolveExcelDir(projectRoot) {

  const fromEnv =
    process.env.JEMMY_DATA_FOLDER &&
    process.env.JEMMY_DATA_FOLDER.trim();

  if (fromEnv) {

    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(projectRoot, fromEnv);
  }

  try {

    const configPath =
      path.join(
        projectRoot,
        "jemmy.config.json"
      );

    const cfg =
      JSON.parse(
        fs.readFileSync(
          configPath,
          "utf8"
        )
      );

    const fromCfg =
      cfg.dataFolder &&
      String(cfg.dataFolder).trim();

    if (fromCfg) {

      return path.isAbsolute(fromCfg)
        ? fromCfg
        : path.join(
            projectRoot,
            fromCfg
          );
    }

  } catch {
    // Fall back to /excel.
  }

  return path.join(
    projectRoot,
    "excel"
  );
}

/*
|--------------------------------------------------------------------------
| Local Excel files
|--------------------------------------------------------------------------
*/

export function listExcelFiles(
  excelDir
) {

  let entries;

  try {

    entries =
      fs.readdirSync(
        excelDir,
        {
          withFileTypes: true
        }
      );

  } catch {

    return [];
  }

  return entries
    .filter(
      e =>
        e.isFile() &&
        EXCEL_EXT_RE.test(e.name) &&
        !e.name.startsWith("~$")
    )
    .map(e => {

      const full =
        path.join(
          excelDir,
          e.name
        );

      const stat =
        fs.statSync(full);

      return {
        name: e.name,
        full,
        mtimeMs: stat.mtimeMs,
        size: stat.size
      };

    });
}

/*
|--------------------------------------------------------------------------
| Local latest Excel
|--------------------------------------------------------------------------
*/

export function getLatestExcelFile(
  excelDir
) {

  const files =
    listExcelFiles(
      excelDir
    );

  if (
    files.length === 0
  ) {
    return null;
  }

  return files.reduce(
    (latest, file) =>
      file.mtimeMs >
      latest.mtimeMs
        ? file
        : latest
  );
}

/*
|--------------------------------------------------------------------------
| Get latest Excel from Supabase
|--------------------------------------------------------------------------
|
| We first try latest/latest.xls.
|
| If that doesn't exist, we try latest/latest.xlsx.
|
|--------------------------------------------------------------------------
*/

async function getSupabaseLatestExcel() {

  const supabase =
    getSupabaseClient();

  /*
   * First try XLS.
   */

  const {
    data: xlsFiles,
    error: xlsListError
  } =
    await supabase.storage
      .from(SUPABASE_BUCKET)
      .list(
        "latest",
        {
          limit: 100,
          search: "latest.xls"
        }
      );

  if (xlsListError) {

    throw new Error(
      `Unable to access Supabase Storage: ${xlsListError.message}`
    );
  }

  const xlsExists =
    (xlsFiles || []).some(
      file =>
        file.name ===
        "latest.xls"
    );

  if (xlsExists) {

    return {
      storagePath:
        SUPABASE_LATEST_XLS,

      fileName:
        "latest.xls",

      extension:
        ".xls"
    };
  }

  /*
   * Then try XLSX.
   */

  const {
    data: xlsxFiles,
    error: xlsxListError
  } =
    await supabase.storage
      .from(SUPABASE_BUCKET)
      .list(
        "latest",
        {
          limit: 100,
          search: "latest.xlsx"
        }
      );

  if (xlsxListError) {

    throw new Error(
      `Unable to access Supabase Storage: ${xlsxListError.message}`
    );
  }

  const xlsxExists =
    (xlsxFiles || []).some(
      file =>
        file.name ===
        "latest.xlsx"
    );

  if (xlsxExists) {

    return {
      storagePath:
        SUPABASE_LATEST_XLSX,

      fileName:
        "latest.xlsx",

      extension:
        ".xlsx"
    };
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Download latest Excel from Supabase
|--------------------------------------------------------------------------
*/

async function downloadSupabaseLatestExcel() {

  const supabase =
    getSupabaseClient();

  const latest =
    await getSupabaseLatestExcel();

  if (!latest) {
    return null;
  }

  const {
    data,
    error
  } =
    await supabase.storage
      .from(SUPABASE_BUCKET)
      .download(
        latest.storagePath
      );

  if (error) {

    throw new Error(
      `Unable to download Excel from Supabase: ${error.message}`
    );
  }

  /*
   * Supabase returns a Blob.
   */

  const arrayBuffer =
    await data.arrayBuffer();

  const buffer =
    Buffer.from(
      arrayBuffer
    );

  return {
    buffer,

    fileName:
      latest.fileName,

    size:
      buffer.length,

    storagePath:
      latest.storagePath
  };
}

/*
|--------------------------------------------------------------------------
| JSON helper
|--------------------------------------------------------------------------
*/

function sendJson(
  res,
  status,
  body
) {

  const json =
    JSON.stringify(
      body
    );

  res.statusCode =
    status;

  res.setHeader(
    "Content-Type",
    "application/json"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.end(json);
}

/*
|--------------------------------------------------------------------------
| META API
|--------------------------------------------------------------------------
*/

export async function handleExcelMeta(
  req,
  res,
  excelDir
) {

  try {

    /*
     * Vercel → Supabase
     */

    if (
      isVercelEnvironment()
    ) {

      const latest =
        await getSupabaseLatestExcel();

      if (!latest) {

        return sendJson(
          res,
          404,
          {
            found: false,
            error:
              NOT_FOUND_MESSAGE
          }
        );
      }

      /*
       * Get metadata from Storage.
       */

      const supabase =
        getSupabaseClient();

      const folder =
        "latest";

      const {
        data: files,
        error
      } =
        await supabase.storage
          .from(
            SUPABASE_BUCKET
          )
          .list(
            folder,
            {
              limit: 100,
              search:
                latest.fileName
            }
          );

      if (error) {

        throw new Error(
          error.message
        );
      }

      const file =
        (files || []).find(
          item =>
            item.name ===
            latest.fileName
        );

      const updatedAt =
        file?.updated_at ||
        file?.created_at ||
        new Date().toISOString();

      const size =
        file?.metadata?.size ||
        0;

      return sendJson(
        res,
        200,
        {
          found: true,

          fileName:
            latest.fileName,

          mtimeMs:
            Date.parse(
              updatedAt
            ),

          size
        }
      );
    }

    /*
     * LOCAL → existing behavior
     */

    const latest =
      getLatestExcelFile(
        excelDir
      );

    if (!latest) {

      return sendJson(
        res,
        404,
        {
          found: false,
          error:
            NOT_FOUND_MESSAGE
        }
      );
    }

    return sendJson(
      res,
      200,
      {
        found: true,

        fileName:
          latest.name,

        mtimeMs:
          latest.mtimeMs,

        size:
          latest.size
      }
    );

  } catch (error) {

    console.error(
      "Excel meta error:",
      error
    );

    return sendJson(
      res,
      500,
      {
        found: false,
        error:
          "Unable to read Excel metadata."
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| FILE API
|--------------------------------------------------------------------------
*/

export async function handleExcelFile(
  req,
  res,
  excelDir
) {

  try {

    /*
     * Vercel → Supabase
     */

    if (
      isVercelEnvironment()
    ) {

      const result =
        await downloadSupabaseLatestExcel();

      if (!result) {

        return sendJson(
          res,
          404,
          {
            error:
              NOT_FOUND_MESSAGE
          }
        );
      }

      res.statusCode =
        200;

      res.setHeader(
        "Content-Type",
        result.fileName.endsWith(
          ".xlsx"
        )
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/vnd.ms-excel"
      );

      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );

      res.setHeader(
        "X-Excel-Filename",
        encodeURIComponent(
          result.fileName
        )
      );

      res.setHeader(
        "X-Excel-Mtime",
        String(
          Date.now()
        )
      );

      res.setHeader(
        "Content-Length",
        String(
          result.size
        )
      );

      return res.end(
        result.buffer
      );
    }

    /*
     * LOCAL → existing behavior
     */

    const latest =
      getLatestExcelFile(
        excelDir
      );

    if (!latest) {

      return sendJson(
        res,
        404,
        {
          error:
            NOT_FOUND_MESSAGE
        }
      );
    }

    const buf =
      fs.readFileSync(
        latest.full
      );

    res.statusCode =
      200;

    res.setHeader(
      "Content-Type",
      "application/octet-stream"
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    res.setHeader(
      "X-Excel-Filename",
      encodeURIComponent(
        latest.name
      )
    );

    res.setHeader(
      "X-Excel-Mtime",
      String(
        latest.mtimeMs
      )
    );

    res.setHeader(
      "Content-Length",
      String(
        buf.length
      )
    );

    return res.end(
      buf
    );

  } catch (error) {

    console.error(
      "Excel file error:",
      error
    );

    return sendJson(
      res,
      500,
      {
        error:
          "Unable to read the Jemmy Excel file."
      }
    );
  }
}