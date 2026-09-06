import { randomUUID } from 'node:crypto';
import { prisma } from '../backend/db/prisma.js';
import { hashPassword } from '../backend/auth/tokens.js';

const password = process.env.E2E_USER_PASSWORD;
const runId = String(process.env.E2E_RUN_ID || Date.now()).replace(/[^a-zA-Z0-9-]/g, '-');
if (!password) throw new Error('E2E_USER_PASSWORD is required');

const romanEmail = `roman-e2e-${runId}@example.test`;
const mishaEmail = `misha-e2e-${runId}@example.test`;
const now = new Date();
const utcDay = now.getUTCDay();
const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
const workDate = new Date(monday.getTime() + 24 * 60 * 60 * 1000);

const companyId = randomUUID();
const romanUserId = randomUUID();
const mishaUserId = randomUUID();
const romanMembershipId = randomUUID();
const mishaMembershipId = randomUUID();
const projectId = randomUUID();
const passwordHash = hashPassword(password);

await prisma.$transaction(async tx => {
  await tx.user.deleteMany({ where: { email: { in: [romanEmail, mishaEmail] } } });

  await tx.company.create({
    data: {
      id: companyId,
      name: `Dual Role E2E ${runId}`,
      slug: `dual-role-e2e-${runId}`.slice(0, 72),
      breakMinutes: 0,
      standardDailyHours: '8.00',
    },
  });

  await tx.user.createMany({
    data: [
      { id: romanUserId, email: romanEmail, passwordHash, firstName: 'Roman', lastName: 'E2E', name: 'Roman E2E', profile: {}, mustChangePassword: false },
      { id: mishaUserId, email: mishaEmail, passwordHash, firstName: 'Misha', lastName: 'E2E', name: 'Misha E2E', profile: {}, mustChangePassword: false },
    ],
  });

  await tx.companyMembership.createMany({
    data: [
      { id: romanMembershipId, companyId, userId: romanUserId, role: 'MANAGER', hourlyRateCzk: '250.00', status: 'ACTIVE' },
      { id: mishaMembershipId, companyId, userId: mishaUserId, role: 'MANAGER', hourlyRateCzk: '250.00', status: 'ACTIVE' },
    ],
  });

  await tx.project.create({
    data: { id: projectId, companyId, name: 'E2E Project', address: 'Prague', description: 'Dual-role browser flow', isActive: true },
  });

  await tx.workEntry.create({
    data: {
      id: randomUUID(),
      companyId,
      employeeMembershipId: romanMembershipId,
      projectId,
      workDate,
      hours: '8.00',
      hourlyRateCzk: '250.00',
      grossHours: '8.00',
      breakMinutes: 0,
      startTime: '07:00',
      endTime: '15:00',
      note: 'Dual-role E2E shift',
      status: 'DRAFT',
    },
  });
});

console.log(JSON.stringify({ romanEmail, mishaEmail, workDate: workDate.toISOString().slice(0, 10) }));
await prisma.$disconnect();
