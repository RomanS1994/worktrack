import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/',
  envDir: path.resolve(__dirname, 'frontend/driverApp'),
  root: path.resolve(__dirname, 'frontend/driverApp'),
  publicDir: 'public',
  appType: 'spa',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'frontend/driverApp/src'),
      '@shared': path.resolve(__dirname, 'frontend/shared/src/react-app'),
    },
  },
  optimizeDeps: {
    include: [],
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          warning.id?.includes('react-router') &&
          String(warning.message || "").includes('"use client"')
        ) {
          return;
        }

        if (
          warning.id?.includes('react-router') &&
          String(warning.message || "").includes(
            "Can't resolve original location of error",
          )
        ) {
          return;
        }

        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return 'vendor';
          }
        },
      },
    },
    outDir: '../../dist',
    emptyOutDir: true,
  },
});
