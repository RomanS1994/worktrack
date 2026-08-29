import { createAuditLog } from '../db/prisma-helpers.js';

function getActiveMembership(context) {
  return context?.activeMembership || context?.membership || context || null;
}

function ensureManagerContext(context) {
  const membership = getActiveMembership(context);

  if (!membership?.companyId || membership.status === 'INACTIVE' || membership.deletedAt) {
    throw new Error('Company access is required');
  }

  if (membership.role !== 'MANAGER') {
    throw new Error('Manager access is required');
  }

  return membership;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRate(value) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Invalid hourly rate');
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid hourly rate');
  return amount.toFixed(2);
}

function restoredEmployeePayload(membership, user) {
  return {
    id: membership.id,
    userId: membership.userId,
    companyId: membership.companyId,
    role: membership.role,
    status: membership.status,
    hourlyRateCzk: membership.hourlyRateCzk == null ? '0.00' : String(membership.hourlyRateCzk),
    pendingSubmissions: 0,
    user: {
      id: user?.id || membership.userId,
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      name: user?.name || '',
      phone: user?.phone || '',
    },
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    name: user?.name || user?.email || '',
    summary: {
      totalHours: '0.00',
      approvedHours: '0.00',
      pendingHours: '0.00',
      confirmedSalaryCzk: '0.00',
      predictedSalaryCzk: '0.00',
    },
  };
}

export async function restoreDeletedManagerEmployee(client, context, payload = {}) {
  const managerMembership = ensureManagerContext(context);
  const email = normalizeEmail(payload.email);
  if (!email) return null;

  const user = await client.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) return null;

  const membership = await client.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: managerMembership.companyId,
        userId: user.id,
      },
    },
  });
  if (!membership?.deletedAt) return null;

  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const hourlyRateCzk = normalizeRate(payload.hourlyRateCzk);
  const updatedUser = await client.user.update({
    where: { id: user.id },
    data: {
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(firstName || lastName
        ? { name: [firstName || user.firstName, lastName || user.lastName].filter(Boolean).join(' ') }
        : {}),
    },
  });
  const restored = await client.companyMembership.update({
    where: { id: membership.id },
    data: {
      status: 'ACTIVE',
      deletedAt: null,
      hourlyRateCzk,
    },
  });

  await createAuditLog(client, {
    action: 'employee.restored',
    actorUserId: managerMembership.userId,
    targetUserId: restored.userId,
    entityType: 'company_membership',
    entityId: restored.id,
    before: {
      status: membership.status,
      deletedAt: membership.deletedAt,
      hourlyRateCzk: membership.hourlyRateCzk == null ? '0.00' : String(membership.hourlyRateCzk),
    },
    after: {
      status: restored.status,
      deletedAt: null,
      hourlyRateCzk: restored.hourlyRateCzk == null ? '0.00' : String(restored.hourlyRateCzk),
    },
  });

  return restoredEmployeePayload(restored, updatedUser);
}

export async function deleteManagerEmployee(client, context, employeeMembershipId) {
  const managerMembership = ensureManagerContext(context);
  const employee = await client.companyMembership.findFirst({
    where: {
      id: employeeMembershipId,
      companyId: managerMembership.companyId,
      role: 'EMPLOYEE',
    },
    include: {
      user: true,
    },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  const before = {
    id: employee.id,
    companyId: employee.companyId,
    userId: employee.userId,
    role: employee.role,
    status: employee.status,
    deletedAt: employee.deletedAt || null,
    hourlyRateCzk: employee.hourlyRateCzk == null ? '0.00' : String(employee.hourlyRateCzk),
    email: employee.user?.email || '',
    name: employee.user?.name || employee.user?.email || '',
  };

  const deletedAt = employee.deletedAt || new Date();
  const archived = employee.deletedAt
    ? employee
    : await client.companyMembership.update({
        where: { id: employee.id },
        data: { status: 'INACTIVE', deletedAt },
        include: { user: true },
      });

  await createAuditLog(client, {
    action: 'employee.deleted',
    actorUserId: managerMembership.userId,
    targetUserId: employee.userId,
    entityType: 'company_membership',
    entityId: employee.id,
    before,
    after: {
      deleted: true,
      softDeleted: true,
      companyId: managerMembership.companyId,
      status: archived.status,
      deletedAt: archived.deletedAt || deletedAt,
    },
  });

  return {
    ok: true,
    employeeId: employee.id,
    archived: true,
  };
}

export async function deleteProject(client, context, projectId) {
  const managerMembership = ensureManagerContext(context);
  const project = await client.project.findFirst({
    where: {
      id: String(projectId || '').trim(),
      companyId: managerMembership.companyId,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const [workEntryCount, managerTimesheetEntryCount] = await Promise.all([
    client.workEntry.count({
      where: {
        companyId: managerMembership.companyId,
        projectId: project.id,
      },
    }),
    client.managerTimesheetEntry.count({
      where: {
        companyId: managerMembership.companyId,
        projectId: project.id,
      },
    }),
  ]);

  if (workEntryCount > 0 || managerTimesheetEntryCount > 0) {
    throw new Error('Project has work history and cannot be deleted. Deactivate it instead.');
  }

  const before = {
    id: project.id,
    companyId: project.companyId,
    name: project.name,
    address: project.address || '',
    description: project.description || '',
    isActive: Boolean(project.isActive),
  };

  await client.project.delete({
    where: {
      id: project.id,
    },
  });

  await createAuditLog(client, {
    action: 'project.deleted',
    actorUserId: managerMembership.userId,
    entityType: 'project',
    entityId: project.id,
    before,
    after: {
      deleted: true,
      companyId: managerMembership.companyId,
    },
  });

  return {
    ok: true,
    projectId: project.id,
  };
}
