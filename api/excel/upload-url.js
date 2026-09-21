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
    // Authenticate our local Node sync program
    const apiKey = req.headers["x-sync-api-key"];

    if (!apiKey || apiKey !== process.env.SYNC_API_KEY) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    const { fileName, hash } = req.body || {};

    if (!fileName || !hash) {
      return res.status(400).json({
        success: false,
        error: "fileName and hash are required"
      });
    }

    // Only allow Excel files
    const lowerName = fileName.toLowerCase();

    let extension;

    if (lowerName.endsWith(".xlsx")) {
      extension = ".xlsx";
    } else if (lowerName.endsWith(".xls")) {
      extension = ".xls";
    } else {
      return res.status(400).json({
        success: false,
        error: "Only .xls and .xlsx files are allowed"
      });
    }

    // Validate SHA-256
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return res.status(400).json({
        success: false,
        error: "Invalid SHA-256 hash"
      });
    }

    // Use hash as the unique filename.
    // Same file content = same path.
    const storagePath = `daily/${hash}${extension}`;

    // Check whether this exact file was already uploaded
    const { data: existingFiles, error: listError } =
      await supabase.storage
        .from(BUCKET)
        .list("daily", {
          limit: 1000,
          search: `${hash}${extension}`
        });

    if (listError) {
      console.error("Storage list error:", listError);

      return res.status(500).json({
        success: false,
        error: "Could not check existing file"
      });
    }

    const alreadyUploaded = (existingFiles || []).some(
      file => file.name === `${hash}${extension}`
    );

    if (alreadyUploaded) {
      return res.status(200).json({
        success: true,
        alreadyUploaded: true,
        storagePath
      });
    }

    // Generate temporary signed upload URL
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error("Signed URL error:", error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      alreadyUploaded: false,
      storagePath,
      token: data.token
    });

  } catch (error) {
    console.error("Upload URL error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
}