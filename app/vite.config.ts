import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: dirname,
  base: '/admin/',
  plugins: [react()],
  server: {
    // The Content SPA imports validation straight from the pure core
    // (../src/domain/files.ts) so the browser and server never disagree —
    // widen Vite's dev-server file allowlist past app/ to the repo root.
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: '../public/admin',
    emptyOutDir: true,
  },
});
