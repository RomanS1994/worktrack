import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/dispatcher/',
  envDir: __dirname,
  root: __dirname,
  appType: 'mpa',
  server: {
    port: 4175,
    strictPort: true,
  },
  preview: {
    port: 4175,
    strictPort: true,
  },
  build: {
    sourcemap: true,
    outDir: path.resolve(__dirname, '../../dist/dispatcher'),
    emptyOutDir: true,
  },
});
