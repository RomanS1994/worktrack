import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from '../config/load-env.js';
import { profileWithoutAvatarData, storeUserAvatar } from '../services/avatars.js';
import { normalizeText, nowIso } from '../validation/common.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(scriptDir, '..', '.env'));

let prisma;
let disconnectDatabase = async () => {};

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;

    const [rawKey, inlineValue] = value.slice(2).split('=');
    const key = normalizeText(rawKey);
    if (!key) continue;

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = nextValue;
    index += 1;
  }

  return args;
}

function parseLimit(value) {
  if (value == null || value === true || value === '') return null;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('--limit must be a positive integer');
  }
  return limit;
}

function printUsage() {
  console.log([
    'Usage:',
    '  node tools/migrate-legacy-avatars.js --dry-run',
    '  node tools/migrate-legacy-avatars.js --limit=100',
    '',
    'Options:',
    '  --dry-run           Count users and validate avatar payloads without writing.',
    '  --limit=N           Process at most N users.',
    '  --include-deleted   Also process soft-deleted users.',
  ].join('\n'));
}

function hasLegacyAvatar(profile) {
  return Boolean(
    profile &&
    typeof profile === 'object' &&
    !Array.isArray(profile) &&
    typeof profile.avatarDataUrl === 'string' &&
    profile.avatarDataUrl
  );
}

async function findLegacyAvatarUsers({ includeDeleted, limit }) {
  const rows = await prisma.$queryRaw`
    SELECT id, email, profile
      FROM users
     WHERE profile ? 'avatarDataUrl'
       AND (${includeDeleted}::boolean OR "deletedAt" IS NULL)
     ORDER BY "updatedAt" ASC
     LIMIT ${limit ?? 1000000}
  `;

  return rows.filter(row => hasLegacyAvatar(row.profile));
}

async function migrateUser(user, { dryRun }) {
  if (dryRun) {
    return { status: 'would-migrate' };
  }

  return prisma.$transaction(async tx => {
    const avatar = await storeUserAvatar(tx, user.id, user.profile);
    if (!avatar) {
      return { status: 'invalid-avatar' };
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        profile: profileWithoutAvatarData(user.profile),
        updatedAt: new Date(nowIso()),
      },
      select: { id: true },
    });

    return { status: 'migrated' };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    return;
  }

  ({ prisma } = await import('../db/prisma.js'));
  ({ disconnectDatabase } = await import('../db/store.js'));

  const dryRun = Boolean(args['dry-run']);
  const includeDeleted = Boolean(args['include-deleted']);
  const limit = parseLimit(args.limit);
  const users = await findLegacyAvatarUsers({ includeDeleted, limit });
  const totals = {
    scanned: users.length,
    migrated: 0,
    wouldMigrate: 0,
    invalidAvatar: 0,
  };

  for (const user of users) {
    const result = await migrateUser(user, { dryRun });
    if (result.status === 'migrated') totals.migrated += 1;
    else if (result.status === 'would-migrate') totals.wouldMigrate += 1;
    else if (result.status === 'invalid-avatar') totals.invalidAvatar += 1;
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    includeDeleted,
    limit,
    ...totals,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
