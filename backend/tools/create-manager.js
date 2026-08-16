import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashPassword } from '../auth/tokens.js';
import { loadEnvFile } from '../config/load-env.js';
import { buildSanitizedUser, createAuditLog } from '../db/prisma-helpers.js';
import { disconnectDatabase, runStoreTransaction } from '../db/store.js';
import { normalizeEmail, normalizeText, nowIso } from '../validation/common.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(scriptDir, '..', '.env'));

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

function splitDisplayName(name) {
  const parts = normalizeText(name).split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || '';

  return {
    firstName,
    lastName: parts.join(' '),
  };
}

function slugifyCompanyName(value) {
  const slug = normalizeText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || `company-${randomUUID().slice(0, 8)}`;
}

async function buildUniqueCompanySlug(tx, companyName) {
  const baseSlug = slugifyCompanyName(companyName);
  let candidate = baseSlug;
  let suffix = 2;

  while (await tx.company.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node tools/create-manager.js --email=manager@example.com --name="Manager" --password="strong-password" --company-name="Acme"',
      '',
      'Options:',
      '  --email              Required. Manager email.',
      '  --company-name       Required. Company name for the manager membership.',
      '  --name               Required for new user. Optional when reusing existing user.',
      '  --password           Required for new user. Optional when reusing existing user.',
    ].join('\n')
  );
}

async function createManagerMembership({
  email,
  name,
  password,
  companyName,
}) {
  return runStoreTransaction({
    prisma: async tx => {
      const timestamp = new Date(nowIso());
      const slug = await buildUniqueCompanySlug(tx, companyName);
      const company = await tx.company.create({
        data: {
          id: randomUUID(),
          name: companyName,
          slug,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });

      const existingUser = await tx.user.findUnique({
        where: {
          email,
        },
      });

      let user = existingUser;

      if (!user) {
        if (!normalizeText(name)) {
          throw new Error('Name is required for a new manager');
        }

        if (!password) {
          throw new Error('Password is required for a new manager');
        }

        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }

        const nameParts = splitDisplayName(name);
        user = await tx.user.create({
          data: {
            id: randomUUID(),
            name: normalizeText(name),
            email,
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            passwordHash: hashPassword(password),
            profile: {},
            mustChangePassword: false,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
      }

      const existingMembership = await tx.companyMembership.findUnique({
        where: {
          companyId_userId: {
            companyId: company.id,
            userId: user.id,
          },
        },
      });

      if (existingMembership) {
        throw new Error('User already belongs to this company');
      }

      const membership = await tx.companyMembership.create({
        data: {
          id: randomUUID(),
          companyId: company.id,
          userId: user.id,
          role: 'MANAGER',
          hourlyRateCzk: null,
          status: 'ACTIVE',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        include: {
          company: true,
        },
      });

      await createAuditLog(tx, {
        action: 'user.manager.provisioned',
        targetUserId: user.id,
        entityType: 'company_membership',
        entityId: membership.id,
        after: {
          companyId: company.id,
          role: membership.role,
        },
        meta: {
          source: 'manager_cli',
        },
      });

      return buildSanitizedUser(tx, user, {
        memberships: [membership],
        activeMembership: membership,
        activeCompany: company,
      });
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    return;
  }

  const email = normalizeEmail(args.email);
  const name = normalizeText(args.name);
  const password = String(args.password || '');
  const companyName = normalizeText(args['company-name']);

  if (!email) {
    throw new Error('Email is required');
  }

  if (!companyName) {
    throw new Error('Company name is required');
  }

  const user = await createManagerMembership({
    email,
    name,
    password,
    companyName,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
      },
      null,
      2
    )
  );
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main()
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectDatabase();
    });
}
