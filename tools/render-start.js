import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const backendDir = path.join(rootDir, 'backend');
const backendServerPath = path.join(backendDir, 'server.js');
const backendRequire = createRequire(backendServerPath);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const isRenderBuildPhase =
  process.env.RENDER === 'true' && process.env.NODE_ENV !== 'production';

function canResolvePackage(packageName) {
  try {
    backendRequire.resolve(`${packageName}/package.json`);
    return true;
  } catch {
    return false;
  }
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureBackendDependencies() {
  if (canResolvePackage('@prisma/client')) {
    return;
  }

  console.log('Installing backend production dependencies...');
  runChecked(npmCommand, ['install', '--omit=dev'], {
    cwd: backendDir,
  });
}

function generatePrismaClient() {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_DATABASE_URL) {
    return;
  }

  runChecked(npmCommand, ['--prefix', 'backend', 'run', 'db:generate']);
}

if (isRenderBuildPhase) {
  console.log(
    'Detected npm start during Render build phase. Running build and exiting.',
  );
  runChecked(npmCommand, ['run', 'build']);
  process.exit(0);
}

ensureBackendDependencies();
generatePrismaClient();

const server = spawn(process.execPath, [backendServerPath], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!server.killed) {
      server.kill(signal);
    }
  });
}

server.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
