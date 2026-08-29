import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { hashPassword } from '../auth/tokens.js';
import { loadEnvFile } from '../config/load-env.js';
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

function money(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid hourly rate: ${value}`);
  return number.toFixed(2);
}

function hours(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(number) || number < 0 || number > 24) throw new Error(`Invalid hours value: ${value}`);
  return number.toFixed(2);
}

function dateKey(month, day) {
  const value = `${month}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date ${value}`);
  }
  return { value, date };
}

function normalizedName(value) {
  return normalizeText(value).toLocaleLowerCase('uk-UA');
}

function employeeMatches(membership, aliases) {
  const user = membership.user || {};
  const candidates = [user.firstName, user.lastName, user.name, `${user.firstName || ''} ${user.lastName || ''}`]
    .map(normalizedName)
    .filter(Boolean);
  return aliases.some(alias => candidates.some(candidate => candidate === alias || candidate.startsWith(`${alias} `)));
}

async function ensureEmployee(tx, companyId, spec, timestamp) {
  const aliases = [spec.name, ...(spec.aliases || [])].map(normalizedName).filter(Boolean);
  const memberships = await tx.companyMembership.findMany({
    where: { companyId, role: 'EMPLOYEE' },
    include: { user: true },
  });
  let membership = memberships.find(item => employeeMatches(item, aliases));

  if (!membership && spec.email) {
    const existingUser = await tx.user.findUnique({ where: { email: normalizeEmail(spec.email) } });
    if (existingUser) {
      membership = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId: existingUser.id } },
        include: { user: true },
      });
    }
  }

  if (!membership) {
    const email = normalizeEmail(spec.email);
    const temporaryPassword = String(spec.temporaryPassword || '');
    if (!email) throw new Error(`Employee ${spec.name} not found and email is missing`);
    if (temporaryPassword.length < 8) throw new Error(`Employee ${spec.name}: temporaryPassword must contain at least 8 characters`);

    const parts = normalizeText(spec.name).split(/\s+/).filter(Boolean);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');
    const user = await tx.user.create({
      data: {
        id: randomUUID(),
        email,
        name: normalizeText(spec.name),
        firstName,
        lastName,
        passwordHash: hashPassword(temporaryPassword),
        mustChangePassword: true,
        profile: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
    membership = await tx.companyMembership.create({
      data: {
        id: randomUUID(),
        companyId,
        userId: user.id,
        role: 'EMPLOYEE',
        hourlyRateCzk: money(spec.hourlyRateCzk),
        status: 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: { user: true },
    });
  } else {
    membership = await tx.companyMembership.update({
      where: { id: membership.id },
      data: { hourlyRateCzk: money(spec.hourlyRateCzk), status: 'ACTIVE', updatedAt: timestamp },
      include: { user: true },
    });
  }

  return membership;
}

async function importPayload(payload, apply) {
  if (!/^\d{4}-\d{2}$/.test(String(payload.month || ''))) throw new Error('month must use YYYY-MM');
  if (!normalizeText(payload.managerEmail)) throw new Error('managerEmail is required');
  if (!Array.isArray(payload.employees) || !payload.employees.length) throw new Error('employees are required');

  return runStoreTransaction({ prisma: async tx => {
    const manager = await tx.companyMembership.findFirst({
      where: {
        role: 'MANAGER',
        status: 'ACTIVE',
        user: { is: { email: normalizeEmail(payload.managerEmail), deletedAt: null } },
      },
      include: { company: true, user: true },
    });
    if (!manager) throw new Error('Manager/company not found');

    const timestamp = new Date(nowIso());
    const projectName = normalizeText(payload.projectName) || `Імпорт ${payload.month}`;
    let project = await tx.project.findFirst({ where: { companyId: manager.companyId, name: projectName } });
    if (!project && apply) {
      project = await tx.project.create({
        data: { id: randomUUID(), companyId: manager.companyId, name: projectName, description: 'Імпорт історичних годин', isActive: true, createdAt: timestamp, updatedAt: timestamp },
      });
    }

    const preview = [];
    for (const spec of payload.employees) {
      const dayEntries = Object.entries(spec.days || {})
        .map(([day, value]) => ({ day: Number(day), hours: hours(value) }))
        .filter(entry => Number(entry.hours) > 0);
      const calculatedTotal = dayEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
      const expectedTotal = Number(String(spec.expectedTotalHours ?? calculatedTotal).replace(',', '.'));
      if (Math.abs(calculatedTotal - expectedTotal) > 0.001) {
        throw new Error(`${spec.name}: daily hours ${calculatedTotal} do not match expected total ${expectedTotal}`);
      }

      let membership = null;
      if (apply) membership = await ensureEmployee(tx, manager.companyId, spec, timestamp);
      else {
        const aliases = [spec.name, ...(spec.aliases || [])].map(normalizedName).filter(Boolean);
        const memberships = await tx.companyMembership.findMany({ where: { companyId: manager.companyId, role: 'EMPLOYEE' }, include: { user: true } });
        membership = memberships.find(item => employeeMatches(item, aliases)) || null;
      }

      if (apply && !project) throw new Error('Import project could not be created');
      if (apply) {
        for (const entry of dayEntries) {
          const { date } = dateKey(payload.month, entry.day);
          const existing = await tx.workEntry.findFirst({
            where: { companyId: manager.companyId, employeeMembershipId: membership.id, projectId: project.id, workDate: date },
          });
          const data = {
            companyId: manager.companyId,
            employeeMembershipId: membership.id,
            projectId: project.id,
            workDate: date,
            hours: entry.hours,
            grossHours: entry.hours,
            breakMinutes: 0,
            hourlyRateCzk: money(spec.hourlyRateCzk),
            note: normalizeText(payload.note) || 'Імпорт з шихтовки',
            status: 'APPROVED',
            weeklySubmissionId: null,
            updatedAt: timestamp,
          };
          if (existing) await tx.workEntry.update({ where: { id: existing.id }, data });
          else await tx.workEntry.create({ data: { id: randomUUID(), ...data, createdAt: timestamp } });
        }
      }

      preview.push({
        name: spec.name,
        employeeFound: Boolean(membership),
        hourlyRateCzk: money(spec.hourlyRateCzk),
        entries: dayEntries.length,
        totalHours: calculatedTotal.toFixed(2),
        salaryCzk: (calculatedTotal * Number(money(spec.hourlyRateCzk))).toFixed(2),
      });
    }

    if (!apply) throw Object.assign(new Error('DRY_RUN_COMPLETE'), { preview, company: manager.company.name, projectName });
    return { ok: true, company: manager.company.name, projectName, employees: preview };
  }});
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error('Usage: node tools/import-month-timesheet.js --file=./import.json [--apply]');
  const payload = JSON.parse(await fs.readFile(path.resolve(args.file), 'utf8'));
  try {
    const result = await importPayload(payload, Boolean(args.apply));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error?.message === 'DRY_RUN_COMPLETE') {
      console.log(JSON.stringify({ ok: true, dryRun: true, company: error.company, projectName: error.projectName, employees: error.preview }, null, 2));
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
