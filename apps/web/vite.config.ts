import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envDir: resolve(__dirname, "../../"),
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
});
