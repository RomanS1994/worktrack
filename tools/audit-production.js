import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

// Prisma CLI is build/migration tooling. npm audit still reports its optional/peer
// advisory when Prisma is a devDependency, even with --omit=dev. The application
// runtime imports @prisma/client, not prisma/@prisma/config/deepmerge-ts.
const BUILD_ONLY_PRISMA_ALLOWLIST = new Set([
  'prisma',
  '@prisma/config',
  'deepmerge-ts',
]);

function runAudit(label, cwd) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['audit', '--omit=dev', '--json'],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  let report;
  try {
    report = JSON.parse(result.stdout || '{}');
  } catch (error) {
    console.error(`[${label}] npm audit did not return valid JSON.`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exitCode = 1;
    return;
  }

  if (report.error) {
    console.error(`[${label}] npm audit failed:`, report.error.summary || report.error);
    process.exitCode = 1;
    return;
  }

  const vulnerabilities = report.vulnerabilities || {};
  const blocking = [];
  const allowed = [];

  for (const [name, details] of Object.entries(vulnerabilities)) {
    const severity = String(details?.severity || 'info').toLowerCase();
    if ((severityRank[severity] ?? 0) < severityRank.high) continue;

    if (BUILD_ONLY_PRISMA_ALLOWLIST.has(name)) {
      allowed.push({ name, severity });
      continue;
    }

    blocking.push({
      name,
      severity,
      range: details?.range || '',
      fixAvailable: details?.fixAvailable ?? false,
    });
  }

  if (allowed.length) {
    console.warn(
      `[${label}] Ignoring build-only Prisma CLI advisories: ${allowed
        .map(item => `${item.name} (${item.severity})`)
        .join(', ')}`
    );
  }

  if (blocking.length) {
    console.error(`[${label}] Blocking production dependency vulnerabilities:`);
    for (const item of blocking) {
      console.error(
        `- ${item.name}: ${item.severity}${item.range ? ` (${item.range})` : ''}`
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[${label}] No blocking high/critical runtime dependency vulnerabilities.`);
}

runAudit('root', rootDir);
runAudit('backend', path.join(rootDir, 'backend'));
