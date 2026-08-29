import { randomUUID } from 'node:crypto';

import { calculateNetWorkEntries } from './work-time-calculation.js';

function parseMonth(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) throw new Error('Invalid month');
  const [year, month] = raw.split('-').map(Number);
  if (month < 1 || month > 12) throw new Error('Invalid month');
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { raw, start, end, year, month };
}

function parseDate(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Invalid date');
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error('Invalid date');
  return { raw, date };
}

function isoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function toNumber(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function sameNumber(a, b) {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(Number(a) - Number(b)) < 0.001;
}

function employeeName(membership) {
  const user = membership.user || {};
  return String(user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Employee');
}

export async function getManagerTimesheet(client, context, { month }) {
  const period = parseMonth(month);
  const manager = context.activeMembership || context.membership || context;
  const companyId = manager.companyId;

  const [employeeMemberships, workEntries, projects, managerEntries, company] = await Promise.all([
    client.companyMembership.findMany({
      where: { companyId, role: 'EMPLOYEE' },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    }),
    client.workEntry.findMany({
      where: { companyId, workDate: { gte: period.start, lt: period.end } },
      select: {
        id: true,
        employeeMembershipId: true,
        workDate: true,
        hours: true,
        grossHours: true,
        breakMinutes: true,
        projectId: true,
        project: { select: { name: true } },
      },
    }),
    client.project.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    client.managerTimesheetEntry.findMany({
      where: { companyId, workDate: { gte: period.start, lt: period.end } },
      select: {
        id: true,
        employeeMembershipId: true,
        workDate: true,
        hours: true,
        breakMinutes: true,
        projectId: true,
        note: true,
      },
    }),
    client.company.findUnique({
      where: { id: companyId },
      select: { breakMinutes: true },
    }),
  ]);

  const employeeIdsWithHistory = new Set([
    ...workEntries.map(entry => entry.employeeMembershipId),
    ...managerEntries.map(entry => entry.employeeMembershipId),
  ]);
  const employees = employeeMemberships.filter(
    membership => membership.status === 'ACTIVE' || employeeIdsWithHistory.has(membership.id)
  );

  const defaultBreakMinutes = Number(company?.breakMinutes || 0);
  const normalizedWorkEntries = calculateNetWorkEntries(workEntries, { breakMinutes: defaultBreakMinutes });

  const employeeDayMap = new Map();
  for (const entry of normalizedWorkEntries) {
    const date = isoDate(entry.workDate);
    const key = `${entry.employeeMembershipId}:${date}`;
    const current = employeeDayMap.get(key) || {
      hours: 0,
      breakMinutes: null,
      projectIds: new Set(),
      projectNames: new Set(),
    };
    current.hours += Number(entry.netHours || 0);
    const entryBreak = entry.breakMinutes == null ? defaultBreakMinutes : Number(entry.breakMinutes || 0);
    current.breakMinutes = Math.max(current.breakMinutes || 0, entryBreak);
    if (entry.projectId) current.projectIds.add(entry.projectId);
    if (entry.project?.name) current.projectNames.add(entry.project.name);
    employeeDayMap.set(key, current);
  }

  const managerDayMap = new Map(
    managerEntries.map(entry => [`${entry.employeeMembershipId}:${isoDate(entry.workDate)}`, entry])
  );

  const daysInMonth = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  let matched = 0;
  let mismatches = 0;
  let missing = 0;

  const rows = employees.map(employee => {
    let employeeTotal = 0;
    let managerTotal = 0;
    let problems = 0;

    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = `${period.raw}-${String(index + 1).padStart(2, '0')}`;
      const key = `${employee.id}:${date}`;
      const employeeEntry = employeeDayMap.get(key);
      const managerEntry = managerDayMap.get(key);
      const employeeHours = employeeEntry ? round2(employeeEntry.hours) : null;
      const managerHours = managerEntry?.hours == null ? null : round2(managerEntry.hours);
      const employeeBreakMinutes = employeeEntry ? employeeEntry.breakMinutes : null;
      const managerBreakMinutes = managerEntry?.breakMinutes == null ? null : Number(managerEntry.breakMinutes);
      const employeeProjectIds = employeeEntry ? [...employeeEntry.projectIds] : [];
      const employeeProjectNames = employeeEntry ? [...employeeEntry.projectNames] : [];
      const managerProjectId = managerEntry?.projectId || null;

      employeeTotal += employeeHours || 0;
      managerTotal += managerHours || 0;

      let status = 'EMPTY';
      const reasons = [];
      if (employeeHours == null && managerHours == null) {
        status = 'EMPTY';
      } else if (employeeHours == null) {
        status = 'MISSING_EMPLOYEE';
        reasons.push('missingEmployee');
      } else if (managerHours == null) {
        status = 'MISSING_MANAGER';
        reasons.push('missingManager');
      } else {
        if (!sameNumber(employeeHours, managerHours)) reasons.push('hours');
        if (managerBreakMinutes != null && employeeBreakMinutes != null && managerBreakMinutes !== employeeBreakMinutes) reasons.push('break');
        if (managerProjectId && (employeeProjectIds.length !== 1 || employeeProjectIds[0] !== managerProjectId)) reasons.push('project');
        status = reasons.length ? 'MISMATCH' : 'MATCH';
      }

      if (status === 'MATCH') matched += 1;
      if (status === 'MISMATCH') {
        mismatches += 1;
        problems += 1;
      }
      if (status === 'MISSING_EMPLOYEE' || status === 'MISSING_MANAGER') {
        missing += 1;
        problems += 1;
      }

      return {
        date,
        day: index + 1,
        status,
        reasons,
        employeeHours,
        managerHours,
        difference: employeeHours == null || managerHours == null ? null : round2(managerHours - employeeHours),
        employeeBreakMinutes,
        managerBreakMinutes,
        employeeProjects: employeeProjectNames,
        employeeProjectIds,
        managerProjectId,
        note: managerEntry?.note || '',
      };
    });

    return {
      employeeId: employee.id,
      name: employeeName(employee),
      status: employee.status,
      employeeTotal: round2(employeeTotal),
      managerTotal: round2(managerTotal),
      difference: round2(managerTotal - employeeTotal),
      problems,
      days,
    };
  });

  return {
    month: period.raw,
    projects,
    summary: {
      employees: rows.length,
      matched,
      mismatches,
      missing,
      problems: mismatches + missing,
    },
    rows,
  };
}

export async function upsertManagerTimesheetCell(client, context, employeeMembershipId, body) {
  const manager = context.activeMembership || context.membership || context;
  const companyId = manager.companyId;
  const { raw: date, date: workDate } = parseDate(body?.date);

  const employee = await client.companyMembership.findFirst({
    where: { id: employeeMembershipId, companyId, role: 'EMPLOYEE', status: 'ACTIVE' },
    select: { id: true },
  });
  if (!employee) throw new Error('Employee not found');

  const hasHoursInput = body?.hours !== '' && body?.hours != null;
  const hours = hasHoursInput ? toNumber(body.hours) : null;
  if (hasHoursInput && hours == null) throw new Error('Invalid hours');
  if (hours != null && (hours < 0 || hours > 24)) throw new Error('Hours must be between 0 and 24');
  const breakMinutes = body?.breakMinutes === '' || body?.breakMinutes == null ? null : Math.round(Number(body.breakMinutes));
  if (breakMinutes != null && (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes > 1440)) throw new Error('Invalid break');
  const projectId = body?.projectId ? String(body.projectId) : null;
  const note = String(body?.note || '').trim().slice(0, 500) || null;

  if (hours == null && breakMinutes == null && !projectId && !note) {
    const existing = await client.managerTimesheetEntry.findUnique({
      where: { employeeMembershipId_workDate: { employeeMembershipId, workDate } },
      select: { id: true, companyId: true },
    });
    if (existing?.companyId === companyId) {
      await client.managerTimesheetEntry.delete({ where: { id: existing.id } });
    }
    return { deleted: Boolean(existing?.companyId === companyId) };
  }

  if (projectId) {
    const project = await client.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new Error('Project not found');
  }

  const existing = await client.managerTimesheetEntry.findUnique({
    where: { employeeMembershipId_workDate: { employeeMembershipId, workDate } },
    select: { id: true, companyId: true },
  });
  if (existing && existing.companyId !== companyId) throw new Error('Timesheet entry belongs to another company');

  const entry = existing
    ? await client.managerTimesheetEntry.update({
        where: { id: existing.id },
        data: { managerMembershipId: manager.id, hours, breakMinutes, projectId, note },
      })
    : await client.managerTimesheetEntry.create({
        data: {
          id: randomUUID(),
          companyId,
          employeeMembershipId,
          managerMembershipId: manager.id,
          workDate,
          hours,
          breakMinutes,
          projectId,
          note,
        },
      });

  return {
    entry: {
      id: entry.id,
      employeeMembershipId: entry.employeeMembershipId,
      workDate: date,
      hours: entry.hours == null ? null : Number(entry.hours),
      breakMinutes: entry.breakMinutes,
      projectId: entry.projectId,
      note: entry.note || '',
    },
  };
}
