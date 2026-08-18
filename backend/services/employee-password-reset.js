import { hashPassword } from '../auth/tokens.js';
import { createAuditLog } from '../db/prisma-helpers.js';
import { nowIso } from '../validation/common.js';

export async function resetEmployeePassword(
  client,
  context,
  employeeMembershipId,
  payload = {}
) {
  const managerMembership = context?.activeMembership;

  if (!managerMembership || managerMembership.role !== 'MANAGER') {
    throw new Error('Manager access is required');
  }

  const temporaryPassword = String(payload.temporaryPassword || payload.password || '');

  if (temporaryPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const employeeMembership = await client.companyMembership.findFirst({
    where: {
      id: employeeMembershipId,
      companyId: managerMembership.companyId,
      role: 'EMPLOYEE',
      user: {
        is: {
          deletedAt: null,
        },
      },
    },
    include: {
      user: true,
    },
  });

  if (!employeeMembership?.user) {
    throw new Error('Employee not found');
  }

  const timestamp = new Date(nowIso());

  await client.user.update({
    where: {
      id: employeeMembership.userId,
    },
    data: {
      passwordHash: hashPassword(temporaryPassword),
      mustChangePassword: true,
      updatedAt: timestamp,
    },
  });

  await client.session.deleteMany({
    where: {
      userId: employeeMembership.userId,
    },
  });

  await createAuditLog(client, {
    action: 'employee.password.reset',
    actorUserId: managerMembership.userId,
    targetUserId: employeeMembership.userId,
    entityType: 'company_membership',
    entityId: employeeMembership.id,
    after: {
      companyId: managerMembership.companyId,
      mustChangePassword: true,
      sessionsRevoked: true,
    },
  });

  return {
    ok: true,
    employeeId: employeeMembership.id,
  };
}
