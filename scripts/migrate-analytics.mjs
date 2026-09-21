// One-time setup for the /analytics dashboard's storage.
//
// Analytics now lives in Supabase (see lib/analyticsDb.js). Supabase's JS client can't run
// DDL, so the table + indexes are created by pasting supabase/analytics-setup.sql into the
// Supabase SQL editor. This script just prints that SQL and where to run it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(here, "..", "supabase", "analytics-setup.sql");

console.log("\nAnalytics uses Supabase. Create the table once in the Supabase SQL editor:\n");
console.log("  Supabase Dashboard -> SQL Editor -> New query -> paste the SQL below -> Run\n");
console.log("--------------------------------------------------------------------------------");
console.log(readFileSync(sqlPath, "utf8").trimEnd());
console.log("--------------------------------------------------------------------------------\n");
