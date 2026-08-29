import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from '../config/load-env.js';
import { disconnectDatabase, runStoreTransaction } from '../db/store.js';
import { createManagerEmployee } from '../services/worktrack.js';
import { normalizeEmail, normalizeText } from '../validation/common.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(scriptDir, '..', '.env'));

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const [key, inlineValue] = token.slice(2).split('=');
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function printUsage() {
  console.log([
    'Usage:',
    '  node tools/create-employee.js --manager-email=manager@example.com --first-name=Michal --last-name=Strizhka --email=employee@example.com --rate=350 --password="temporary-password"',
    '',
    'Notes:',
    '  - Password is supplied only at runtime and is never stored in the repository.',
    '  - If the employee already belongs to the company, the command exits without creating a duplicate.',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    return;
  }

  const managerEmail = normalizeEmail(args['manager-email']);
  const firstName = normalizeText(args['first-name']);
  const lastName = normalizeText(args['last-name']);
  const email = normalizeEmail(args.email);
  const temporaryPassword = String(args.password || '');
  const hourlyRateCzk = Number(String(args.rate ?? '').replace(',', '.'));

  if (!managerEmail) throw new Error('manager-email is required');
  if (!firstName) throw new Error('first-name is required');
  if (!lastName) throw new Error('last-name is required');
  if (!email) throw new Error('email is required');
  if (temporaryPassword.length < 8) throw new Error('password must be at least 8 characters');
  if (!Number.isFinite(hourlyRateCzk) || hourlyRateCzk < 0) throw new Error('rate must be a non-negative number');

  const result = await runStoreTransaction({
    prisma: async client => {
      const managerMembership = await client.companyMembership.findFirst({
        where: {
          role: 'MANAGER',
          status: 'ACTIVE',
          user: { is: { email: managerEmail, deletedAt: null } },
        },
        include: { company: true, user: true },
      });

      if (!managerMembership) throw new Error('Manager/company not found');

      const existingUser = await client.user.findUnique({ where: { email } });
      if (existingUser) {
        const existingMembership = await client.companyMembership.findUnique({
          where: {
            companyId_userId: {
              companyId: managerMembership.companyId,
              userId: existingUser.id,
            },
          },
          include: { user: true },
        });

        if (existingMembership) {
          return {
            created: false,
            employee: {
              id: existingMembership.id,
              email: existingMembership.user.email,
              status: existingMembership.status,
              hourlyRateCzk: String(existingMembership.hourlyRateCzk ?? ''),
            },
          };
        }
      }

      const context = {
        activeMembership: managerMembership,
        activeCompany: managerMembership.company,
        membership: managerMembership,
      };

      const employee = await createManagerEmployee(client, context, {
        firstName,
        lastName,
        email,
        temporaryPassword,
        hourlyRateCzk,
      });

      return {
        created: true,
        employee: {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          status: employee.status,
          hourlyRateCzk: employee.hourlyRateCzk,
        },
      };
    },
  });

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
