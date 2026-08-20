import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { excelFolderPlugin } from "./vite-excel-plugin.js";

// base: "./" lets the built app be served from any folder/path.
// host: true exposes the dev & preview servers on the local network (0.0.0.0).
export default defineConfig({
  plugins: [react(), excelFolderPlugin()],
  base: "./",
  // excel/ is read directly by excelFolderPlugin on each request, not via HMR, so it
  // doesn't need to be watched. Watching it is actively harmful: Excel drops short-lived
  // temp files there while saving (e.g. a random-named lock file with no extension), and
  // an EBUSY error on one of those crashes the whole dev server's file watcher.
  server: { host: true, port: 5173, watch: { ignored: ["**/excel/**"] } },
  preview: { host: true, port: 8080 },
});
