import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function run(name, script) {
  const child = spawn(npmCommand, ['run', script], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', code => {
    if (code && code !== 0) {
      process.exitCode = code;
    }

    shutdown();
  });

  children.push({ name, child });
}

function shutdown() {
  for (const entry of children) {
    if (!entry.child.killed) {
      entry.child.kill('SIGTERM');
    }
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

run('client', 'dev:client');
run('server', 'dev:server');
