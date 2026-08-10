import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: dirname,
  base: '/admin/',
  plugins: [react()],
  build: {
    outDir: '../public/admin',
    emptyOutDir: true,
  },
});
