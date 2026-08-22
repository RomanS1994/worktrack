import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendEnvDir = path.resolve(__dirname, 'frontend/webApp');

function buildInfoPlugin() {
  const commit = String(process.env.COMMIT_REF || process.env.GITHUB_SHA || '').trim();
  const branch = String(process.env.BRANCH || process.env.GITHUB_REF_NAME || '').trim();
  const context = String(process.env.CONTEXT || '').trim();

  return {
    name: 'worktrack-build-info',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: JSON.stringify({
          commit,
          branch,
          context,
          generatedAt: new Date().toISOString(),
        }),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendEnvDir, 'VITE_');
  const apiBaseUrl = String(env.VITE_API_BASE_URL || '').trim();

  if (mode === 'production' && !apiBaseUrl) {
    throw new Error(
      'VITE_API_BASE_URL is required for production builds. Configure the deployed backend API URL before publishing WorkTrack.'
    );
  }

  return {
    plugins: [react(), buildInfoPlugin()],
    base: '/',
    envDir: frontendEnvDir,
    root: path.resolve(__dirname, 'frontend/webApp'),
    publicDir: 'public',
    appType: 'spa',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'frontend/webApp/src'),
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
