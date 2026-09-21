import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const BUCKET = "msjpl-excel";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = req.headers["x-sync-api-key"];

    if (!apiKey || apiKey !== process.env.SYNC_API_KEY) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    const {
      storagePath,
      originalFileName,
      hash
    } = req.body || {};

    if (!storagePath || !originalFileName || !hash) {
      return res.status(400).json({
        success: false,
        error: "storagePath, originalFileName and hash are required"
      });
    }

    const lowerName = originalFileName.toLowerCase();

    let extension;

    if (lowerName.endsWith(".xlsx")) {
      extension = ".xlsx";
    } else if (lowerName.endsWith(".xls")) {
      extension = ".xls";
    } else {
      return res.status(400).json({
        success: false,
        error: "Invalid Excel file"
      });
    }

    const latestPath = `latest/latest${extension}`;

    // Remove old latest file if it exists
    await supabase.storage
      .from(BUCKET)
      .remove([latestPath]);

    // Copy uploaded file to latest/
    const { error: copyError } = await supabase.storage
      .from(BUCKET)
      .copy(storagePath, latestPath);

    if (copyError) {
      console.error("Copy error:", copyError);

      return res.status(500).json({
        success: false,
        error: copyError.message
      });
    }

    // Remove the opposite extension if present
    const oldExtension = extension === ".xls"
      ? ".xlsx"
      : ".xls";

    await supabase.storage
      .from(BUCKET)
      .remove([`latest/latest${oldExtension}`]);

    return res.status(200).json({
      success: true,
      latestPath,
      originalFileName,
      hash
    });

  } catch (error) {
    console.error("Finalize error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
}