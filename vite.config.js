import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendEnvDir = path.resolve(__dirname, 'frontend/driverApp');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendEnvDir, 'VITE_');
  const apiBaseUrl = String(env.VITE_API_BASE_URL || '').trim();

  if (mode === 'production' && !apiBaseUrl) {
    throw new Error(
      'VITE_API_BASE_URL is required for production builds. Configure the deployed backend API URL before publishing WorkTrack.'
    );
  }

  return {
    plugins: [react()],
    base: '/',
    envDir: frontendEnvDir,
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
            String(warning.message || '').includes('"use client"')
          ) {
            return;
          }

          if (
            warning.id?.includes('react-router') &&
            String(warning.message || '').includes(
              "Can't resolve original location of error"
            )
          ) {
            return;
          }

          warn(warning);
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
      outDir: '../../dist',
      emptyOutDir: true,
    },
  };
});
