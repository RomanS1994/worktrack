import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from '../config/load-env.js';
import { disconnectDatabase, runStoreTransaction } from '../db/store.js';
import { normalizeEmail, normalizeText } from '../validation/common.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(scriptDir, '..', '.env'));

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const [rawKey, inlineValue] = value.slice(2).split('=');
    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args[rawKey] = true;
    else {
      args[rawKey] = next;
      index += 1;
    }
  }
  return args;
}

function normalizedName(value) {
  return normalizeText(value).toLocaleLowerCase('uk-UA');
}

function employeeMatches(membership, aliases) {
  const user = membership.user || {};
  const candidates = [
    user.firstName,
    user.lastName,
    user.name,
    `${user.firstName || ''} ${user.lastName || ''}`,
  ]
    .map(normalizedName)
    .filter(Boolean);

  return aliases.some(alias => candidates.some(candidate => candidate === alias || candidate.startsWith(`${alias} `)));
}

function hours(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(number) || number < 0 || number > 24) {
    throw new Error(`Invalid hours value: ${value}`);
  }
  return number;
}

function dateKey(month, day) {
  const value = `${month}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date ${value}`);
  }
  return { value, date };
}

async function findEmployee(tx, companyId, spec) {
  const aliases = [spec.name, ...(spec.aliases || [])].map(normalizedName).filter(Boolean);
  const memberships = await tx.companyMembership.findMany({
    where: {
      companyId,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      deletedAt: null,
      user: { is: { deletedAt: null } },
    },
    include: { user: true },
  });

  const membership = memberships.find(item => employeeMatches(item, aliases));
  if (!membership) throw new Error(`Active employee not found: ${spec.name}`);
  return membership;
}

async function importPayload(payload, apply) {
  if (!/^\d{4}-\d{2}$/.test(String(payload.month || ''))) {
    throw new Error('month must use YYYY-MM');
  }
  if (!normalizeText(payload.managerEmail)) throw new Error('managerEmail is required');
  if (!Array.isArray(payload.employees) || !payload.employees.length) throw new Error('employees are required');

  return runStoreTransaction({ prisma: async tx => {
    const manager = await tx.companyMembership.findFirst({
      where: {
        role: 'MANAGER',
        status: 'ACTIVE',
        deletedAt: null,
        user: { is: { email: normalizeEmail(payload.managerEmail), deletedAt: null } },
      },
      include: { company: true, user: true },
    });
    if (!manager) throw new Error('Manager/company not found');

    const projectName = normalizeText(payload.projectName);
    const importProject = projectName
      ? await tx.project.findFirst({ where: { companyId: manager.companyId, name: projectName } })
      : null;

    const preview = [];
    for (const spec of payload.employees) {
      const dayEntries = Object.entries(spec.days || {})
        .map(([day, value]) => ({ day: Number(day), hours: hours(value) }))
        .filter(entry => entry.hours > 0);

      const calculatedTotal = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const expectedTotal = Number(String(spec.expectedTotalHours ?? calculatedTotal).replace(',', '.'));
      if (!Number.isFinite(expectedTotal) || Math.abs(calculatedTotal - expectedTotal) > 0.001) {
        throw new Error(`${spec.name}: daily hours ${calculatedTotal} do not match expected total ${expectedTotal}`);
      }

      const membership = await findEmployee(tx, manager.companyId, spec);
      let created = 0;
      let updated = 0;
      let removedLegacyWorkerEntries = 0;

      for (const entry of dayEntries) {
        const { date } = dateKey(payload.month, entry.day);
        const existing = await tx.managerTimesheetEntry.findUnique({
          where: {
            employeeMembershipId_workDate: {
              employeeMembershipId: membership.id,
              workDate: date,
            },
          },
        });

        if (apply) {
          const data = {
            companyId: manager.companyId,
            employeeMembershipId: membership.id,
            managerMembershipId: manager.id,
            workDate: date,
            hours: entry.hours.toFixed(2),
            breakMinutes: null,
            projectId: null,
            note: normalizeText(payload.note) || 'Імпорт з таблиці менеджера',
          };

          if (existing) {
            await tx.managerTimesheetEntry.update({ where: { id: existing.id }, data });
            updated += 1;
          } else {
            await tx.managerTimesheetEntry.create({ data: { id: randomUUID(), ...data } });
            created += 1;
          }

          if (payload.cleanupWorkerImports === true && importProject) {
            const deleted = await tx.workEntry.deleteMany({
              where: {
                companyId: manager.companyId,
                employeeMembershipId: membership.id,
                projectId: importProject.id,
                workDate: date,
                weeklySubmissionId: null,
                status: 'APPROVED',
              },
            });
            removedLegacyWorkerEntries += deleted.count;
          }
        }
      }

      preview.push({
        name: spec.name,
        employeeId: membership.id,
        entries: dayEntries.length,
        totalHours: calculatedTotal.toFixed(2),
        managerEntriesCreated: created,
        managerEntriesUpdated: updated,
        legacyWorkerEntriesRemoved: removedLegacyWorkerEntries,
      });
    }

    if (!apply) {
      throw Object.assign(new Error('DRY_RUN_COMPLETE'), {
        preview,
        company: manager.company.name,
      });
    }

    return {
      ok: true,
      company: manager.company.name,
      month: payload.month,
      employees: preview,
    };
  }});
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    throw new Error('Usage: node backend/tools/import-manager-timesheet.js --file=./import.json [--apply]');
  }

  const payload = JSON.parse(await fs.readFile(path.resolve(args.file), 'utf8'));
  try {
    const result = await importPayload(payload, Boolean(args.apply));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error?.message === 'DRY_RUN_COMPLETE') {
      console.log(JSON.stringify({
        ok: true,
        dryRun: true,
        company: error.company,
        month: payload.month,
        employees: error.preview,
      }, null, 2));
      return;
    }
    throw error;
  }
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
