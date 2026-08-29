import { createAuditLog } from '../db/prisma-helpers.js';

function getActiveMembership(context) {
  return context?.activeMembership || context?.membership || context || null;
}

function ensureManagerContext(context) {
  const membership = getActiveMembership(context);

  if (!membership?.companyId || membership.status === 'INACTIVE') {
    throw new Error('Company access is required');
  }

  if (membership.role !== 'MANAGER') {
    throw new Error('Manager access is required');
  }

  return membership;
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
    hourlyRateCzk: employee.hourlyRateCzk == null ? '0.00' : String(employee.hourlyRateCzk),
    email: employee.user?.email || '',
    name: employee.user?.name || employee.user?.email || '',
  };

  // Employee deletion is intentionally a soft delete. Work entries, submissions,
  // invoices, salary advances and manager timesheet history all reference the
  // membership with cascading relations, so physically deleting it would erase
  // financial history. INACTIVE immediately revokes company access because auth
  // only loads ACTIVE memberships.
  const archived = employee.status === 'INACTIVE'
    ? employee
    : await client.companyMembership.update({
        where: { id: employee.id },
        data: { status: 'INACTIVE' },
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
