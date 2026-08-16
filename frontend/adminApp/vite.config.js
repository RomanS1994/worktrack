import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  envDir: __dirname,
  root: __dirname,
  publicDir: path.resolve(__dirname, '../driverApp/public'),
  appType: 'spa',
  server: {
    port: 4174,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../shared/src/react-app'),
    },
  },
  optimizeDeps: {
    include: [],
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    outDir: path.resolve(__dirname, '../../dist/admin'),
    emptyOutDir: true,
  },
});
