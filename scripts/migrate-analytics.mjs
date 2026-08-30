// One-time setup: creates the analytics_events table + indexes. Run with `npm run db:migrate`
// after setting DATABASE_URL (see README.md's Visitor analytics section). Not run
// automatically per-request — keeps the hot visitor-tracking path fast.
try {
  process.loadEnvFile();
} catch {
  // no .env file — fine if the connection string is already in the real environment
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!connectionString) {
  console.error(
    "No Postgres connection string found. Set DATABASE_URL in your environment or a local .env file, then re-run `npm run db:migrate`."
  );
  process.exit(1);
}

const { neon } = await import("@neondatabase/serverless");
const { runMigration } = await import("../lib/analyticsDb.js");

const sql = neon(connectionString);
console.log("Creating analytics_events table and indexes (if they don't already exist)...");
await runMigration(sql);
console.log("Done.");
