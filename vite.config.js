import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { excelFolderPlugin } from "./vite-excel-plugin.js";

// base: "./" lets the built app be served from any folder/path.
// host: true exposes the dev & preview servers on the local network (0.0.0.0).
export default defineConfig({
  plugins: [react(), excelFolderPlugin()],
  base: "./",
  server: { host: true, port: 5173 },
  preview: { host: true, port: 8080 },
});
