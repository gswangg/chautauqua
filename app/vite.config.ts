import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// DEC-001: app/ is the admin React SPA with its own Vite root + tsconfig,
// building to public/admin/ so the Worker's assets directory (public/) serves
// it. Paths are resolved from this file so the config works regardless of cwd.
const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  base: "/admin/",
  plugins: [react()],
  build: {
    outDir: resolve(here, "../public/admin"),
    emptyOutDir: true,
  },
});
