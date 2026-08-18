import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasEmployeeAccess,
  hasManagerAccess,
} from '../auth/guards.js';
import { buildSanitizedUser } from '../db/prisma-helpers.js';
import { registerCompanyAccount } from '../services/company-registration.js';
import {
  createEmployeeWorkEntry,
  createManagerEmployee,
  createProject,
  getEmployeeDashboardSummary,
  listManagerEmployees,
  listManagerSubmissions,
  listProjects,
  reviewWeeklySubmission,
  submitEmployeeWeek,
  updateEmployeeMembership,
  updateEmployeeWorkEntry,
} from '../services/worktrack.js';

const BASE_DATE = new Date('2026-08-16T08:00:00.000Z');

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function sameDate(left, right) {
  return toDate(left).toISOString() === toDate(right).toISOString();
}

function applyOrderBy(rows, orderBy) {
  const orderItems = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return [...rows].sort((left, right) => {
    for (const item of orderItems) {
      const [[field, direction]] = Object.entries(item);
      const leftValue = left[field] instanceof Date ? left[field].getTime() : left[field] ?? 0;
      const rightValue = right[field] instanceof Date ? right[field].getTime() : right[field] ?? 0;
      const result = leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0;

      if (result !== 0) {
        return direction === 'desc' ? -result : result;
      }
    }

    return 0;
  });
}

function matchesValue(actual, expected) {
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    if (expected.in && !expected.in.includes(actual)) return false;
    if (expected.not !== undefined && actual === expected.not) return false;
    if (expected.gte && toDate(actual) < toDate(expected.gte)) return false;
    if (expected.lt && toDate(actual) >= toDate(expected.lt)) return false;
    return true;
  }

  if (expected instanceof Date) {
    return sameDate(actual, expected);
  }

  return actual === expected;
}

function createFakeWorkTrackClient(seed = {}) {
  const state = {
    users: seed.users || [],
    companies: seed.companies || [],
    memberships: seed.memberships || [],
    projects: seed.projects || [],
    workEntries: seed.workEntries || [],
    weeklySubmissions: seed.weeklySubmissions || [],
    sessions: [],
    auditLogs: [],
  };

  function findUser(id) {
    return state.users.find(user => user.id === id) || null;
  }

  function findCompany(id) {
    return state.companies.find(company => company.id === id) || null;
  }

  function findMembership(id) {
    return state.memberships.find(membership => membership.id === id) || null;
  }

  function findProject(id) {
    return state.projects.find(project => project.id === id) || null;
  }

  function matchesUserWhere(user, where = {}) {
    const filter = where.is || where;
    if (!filter) return true;
    if (filter.id !== undefined && !matchesValue(user.id, filter.id)) return false;
    if (filter.email !== undefined && !matchesValue(user.email, filter.email)) return false;
    if (filter.deletedAt !== undefined && user.deletedAt !== filter.deletedAt) return false;
    return true;
  }

  function matchesMembershipWhere(membership, where = {}) {
    if (where.id !== undefined && !matchesValue(membership.id, where.id)) return false;
    if (where.companyId !== undefined && membership.companyId !== where.companyId) return false;
    if (where.userId !== undefined && membership.userId !== where.userId) return false;
    if (where.role !== undefined && membership.role !== where.role) return false;
    if (where.status !== undefined && membership.status !== where.status) return false;
    if (where.user && !matchesUserWhere(findUser(membership.userId), where.user)) return false;
    return true;
  }

  function matchesProjectWhere(project, where = {}) {
    if (where.id !== undefined && !matchesValue(project.id, where.id)) return false;
    if (where.companyId !== undefined && project.companyId !== where.companyId) return false;
    if (where.isActive !== undefined && project.isActive !== where.isActive) return false;
    return true;
  }

  function matchesWorkEntryWhere(entry, where = {}) {
    if (where.id !== undefined && !matchesValue(entry.id, where.id)) return false;
    if (where.companyId !== undefined && entry.companyId !== where.companyId) return false;
    if (
      where.employeeMembershipId !== undefined &&
      entry.employeeMembershipId !== where.employeeMembershipId
    ) {
      return false;
    }
    if (where.projectId !== undefined && entry.projectId !== where.projectId) return false;
    if (where.weeklySubmissionId !== undefined && entry.weeklySubmissionId !== where.weeklySubmissionId) {
      return false;
    }
    if (where.status !== undefined && !matchesValue(entry.status, where.status)) return false;
    if (where.workDate !== undefined && !matchesValue(entry.workDate, where.workDate)) return false;
    if (
      where.employeeMembership &&
      !matchesMembershipWhere(findMembership(entry.employeeMembershipId), where.employeeMembership.is || where.employeeMembership)
    ) {
      return false;
    }
    return true;
  }

  function matchesSubmissionWhere(submission, where = {}) {
    if (where.id !== undefined && !matchesValue(submission.id, where.id)) return false;
    if (where.companyId !== undefined && submission.companyId !== where.companyId) return false;
    if (
      where.employeeMembershipId !== undefined &&
      submission.employeeMembershipId !== where.employeeMembershipId
    ) {
      return false;
    }
    if (where.status !== undefined && !matchesValue(submission.status, where.status)) return false;
    if (
      where.employeeMembership &&
      !matchesMembershipWhere(
        findMembership(submission.employeeMembershipId),
        where.employeeMembership.is || where.employeeMembership
      )
    ) {
      return false;
    }
    return true;
  }

  function attachMembershipRelations(membership, include = {}) {
    const next = { ...membership };

    if (include.company) {
      next.company = findCompany(membership.companyId);
    }

    if (include.user) {
      next.user = findUser(membership.userId);
    }

    if (include.workEntries) {
      const options = include.workEntries === true ? {} : include.workEntries;
      next.workEntries = applyOrderBy(
        state.workEntries.filter(
          entry =>
            entry.employeeMembershipId === membership.id &&
            matchesWorkEntryWhere(entry, options.where || {})
        ),
        options.orderBy
      );
    }

    if (include.weeklySubmissions) {
      const options = include.weeklySubmissions === true ? {} : include.weeklySubmissions;
      const submissions = state.weeklySubmissions.filter(
        submission =>
          submission.employeeMembershipId === membership.id &&
          matchesSubmissionWhere(submission, options.where || {})
      );
      next.weeklySubmissions = options.select?.id
        ? submissions.map(submission => ({ id: submission.id }))
        : submissions;
    }

    return next;
  }

  function attachWorkEntryRelations(entry, include = {}) {
    const next = { ...entry };

    if (include.weeklySubmission) {
      next.weeklySubmission =
        state.weeklySubmissions.find(submission => submission.id === entry.weeklySubmissionId) ||
        null;
    }

    if (include.project) {
      next.project = findProject(entry.projectId);
    }

    if (include.employeeMembership) {
      const options = include.employeeMembership === true ? {} : include.employeeMembership;
      next.employeeMembership = attachMembershipRelations(
        findMembership(entry.employeeMembershipId),
        options.include || {}
      );
    }

    return next;
  }

  function attachSubmissionRelations(submission, include = {}) {
    const next = { ...submission };

    if (include.employeeMembership) {
      const options = include.employeeMembership === true ? {} : include.employeeMembership;
      next.employeeMembership = attachMembershipRelations(
        findMembership(submission.employeeMembershipId),
        options.include || {}
      );
    }

    if (include.workEntries) {
      const options = include.workEntries === true ? {} : include.workEntries;
      const entries = state.workEntries.filter(
        entry => entry.weeklySubmissionId === submission.id
      );
      next.workEntries = applyOrderBy(entries, options.orderBy).map(entry =>
        attachWorkEntryRelations(entry, options.include || {})
      );
    }

    return next;
  }

  return {
    state,
    user: {
      findUnique: async ({ where = {} }) =>
        state.users.find(user => user.id === where.id || user.email === where.email) || null,
      create: async ({ data }) => {
        const { sessions, ...userData } = data;
        const user = { ...userData, deletedAt: null };
        state.users.push(user);
        if (sessions?.create) {
          state.sessions.push({
            ...sessions.create,
            userId: user.id,
          });
        }
        return { ...user };
      },
      update: async ({ where, data }) => {
        const user = state.users.find(item => item.id === where.id);
        Object.assign(user, data);
        return { ...user };
      },
    },
    company: {
      findUnique: async ({ where = {} }) =>
        state.companies.find(company => company.id === where.id || company.slug === where.slug) ||
        null,
      create: async ({ data }) => {
        const company = { ...data };
        state.companies.push(company);
        return { ...company };
      },
      update: async ({ where, data }) => {
        const company = state.companies.find(item => item.id === where.id);
        Object.assign(company, data);
        return { ...company };
      },
    },
    companyMembership: {
      count: async ({ where = {} } = {}) =>
        state.memberships.filter(membership => matchesMembershipWhere(membership, where)).length,
      findMany: async ({ where = {}, include = {}, orderBy } = {}) =>
        applyOrderBy(
          state.memberships.filter(membership => matchesMembershipWhere(membership, where)),
          orderBy
        ).map(membership => attachMembershipRelations(membership, include)),
      findFirst: async ({ where = {}, include = {} } = {}) => {
        const membership = state.memberships.find(item => matchesMembershipWhere(item, where));
        return membership ? attachMembershipRelations(membership, include) : null;
      },
      findUnique: async ({ where = {}, include = {} } = {}) => {
        const compound = where.companyId_userId;
        const membership = compound
          ? state.memberships.find(
              item =>
                item.companyId === compound.companyId &&
                item.userId === compound.userId
            )
          : state.memberships.find(item => item.id === where.id);
        return membership ? attachMembershipRelations(membership, include) : null;
      },
      create: async ({ data, include = {} }) => {
        const membership = { ...data };
        state.memberships.push(membership);
        return attachMembershipRelations(membership, include);
      },
      update: async ({ where, data, include = {} }) => {
        const membership = state.memberships.find(item => item.id === where.id);
        Object.assign(membership, data);
        return attachMembershipRelations(membership, include);
      },
    },
    project: {
      count: async ({ where = {} } = {}) =>
        state.projects.filter(project => matchesProjectWhere(project, where)).length,
      findMany: async ({ where = {}, orderBy } = {}) =>
        applyOrderBy(
          state.projects.filter(project => matchesProjectWhere(project, where)),
          orderBy
        ),
      findFirst: async ({ where = {} } = {}) =>
        state.projects.find(project => matchesProjectWhere(project, where)) || null,
      create: async ({ data }) => {
        const project = { ...data };
        state.projects.push(project);
        return { ...project };
      },
      update: async ({ where, data }) => {
        const project = state.projects.find(item => item.id === where.id);
        Object.assign(project, data);
        return { ...project };
      },
    },
    workEntry: {
      findMany: async ({ where = {}, include = {}, orderBy } = {}) =>
        applyOrderBy(
          state.workEntries.filter(entry => matchesWorkEntryWhere(entry, where)),
          orderBy
        ).map(entry => attachWorkEntryRelations(entry, include)),
      findFirst: async ({ where = {}, include = {} } = {}) => {
        const entry = state.workEntries.find(item => matchesWorkEntryWhere(item, where));
        return entry ? attachWorkEntryRelations(entry, include) : null;
      },
      findUnique: async ({ where = {}, include = {} }) => {
        const entry = state.workEntries.find(item => item.id === where.id);
        return entry ? attachWorkEntryRelations(entry, include) : null;
      },
      create: async ({ data, include = {} }) => {
        const entry = { ...data };
        state.workEntries.push(entry);
        return attachWorkEntryRelations(entry, include);
      },
      update: async ({ where, data, include = {} }) => {
        const entry = state.workEntries.find(item => item.id === where.id);
        Object.assign(entry, data);
        return attachWorkEntryRelations(entry, include);
      },
      updateMany: async ({ where = {}, data }) => {
        const entries = state.workEntries.filter(entry => matchesWorkEntryWhere(entry, where));
        entries.forEach(entry => Object.assign(entry, data));
        return { count: entries.length };
      },
      delete: async ({ where }) => {
        const index = state.workEntries.findIndex(entry => entry.id === where.id);
        const [entry] = state.workEntries.splice(index, 1);
        return entry;
      },
    },
    weeklySubmission: {
      count: async ({ where = {} } = {}) =>
        state.weeklySubmissions.filter(submission => matchesSubmissionWhere(submission, where))
          .length,
      findMany: async ({ where = {}, include = {}, orderBy } = {}) =>
        applyOrderBy(
          state.weeklySubmissions.filter(submission => matchesSubmissionWhere(submission, where)),
          orderBy
        ).map(submission => attachSubmissionRelations(submission, include)),
      findUnique: async ({ where = {}, include = {} }) => {
        const compound = where.employeeMembershipId_weekStart;
        const submission = compound
          ? state.weeklySubmissions.find(
              item =>
                item.employeeMembershipId === compound.employeeMembershipId &&
                sameDate(item.weekStart, compound.weekStart)
            )
          : state.weeklySubmissions.find(item => item.id === where.id);
        return submission ? attachSubmissionRelations(submission, include) : null;
      },
      findFirst: async ({ where = {}, include = {} }) => {
        const submission = state.weeklySubmissions.find(item =>
          matchesSubmissionWhere(item, where)
        );
        return submission ? attachSubmissionRelations(submission, include) : null;
      },
      create: async ({ data }) => {
        const submission = { ...data };
        state.weeklySubmissions.push(submission);
        return { ...submission };
      },
      update: async ({ where, data }) => {
        const submission = state.weeklySubmissions.find(item => item.id === where.id);
        Object.assign(submission, data);
        return { ...submission };
      },
    },
    auditLog: {
      create: async ({ data }) => {
        state.auditLogs.push(data);
        return data;
      },
    },
  };
}

function fakeIssueAuthSession(userId) {
  return {
    refreshToken: `refresh-${userId}`,
    accessToken: `access-${userId}`,
    accessTokenExpiresAt: '2026-08-16T09:00:00.000Z',
    session: {
      id: `session-${userId}`,
      userId,
      tokenHash: `hash-${userId}`,
      createdAt: '2026-08-16T08:00:00.000Z',
      expiresAt: '2026-09-16T08:00:00.000Z',
    },
  };
}

function createSeed() {
  const companyA = {
    id: 'company-a',
    name: 'Company A',
    slug: 'company-a',
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const companyB = {
    id: 'company-b',
    name: 'Company B',
    slug: 'company-b',
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const managerA = {
    id: 'manager-a',
    email: 'manager-a@example.com',
    name: 'Manager A',
    firstName: 'Manager',
    lastName: 'A',
    passwordHash: 'hash',
    profile: {},
    deletedAt: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const managerB = {
    ...managerA,
    id: 'manager-b',
    email: 'manager-b@example.com',
    name: 'Manager B',
    lastName: 'B',
  };
  const employee = {
    ...managerA,
    id: 'employee-a',
    email: 'employee-a@example.com',
    name: 'Employee A',
    firstName: 'Employee',
    lastName: 'A',
  };
  const sharedEmployee = {
    ...managerA,
    id: 'shared-employee',
    email: 'shared@example.com',
    name: 'Shared Employee',
    firstName: 'Shared',
    lastName: 'Employee',
  };
  const managerMembershipA = {
    id: 'membership-manager-a',
    companyId: companyA.id,
    userId: managerA.id,
    role: 'MANAGER',
    hourlyRateCzk: null,
    status: 'ACTIVE',
    company: companyA,
    user: managerA,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const managerMembershipB = {
    id: 'membership-manager-b',
    companyId: companyB.id,
    userId: managerB.id,
    role: 'MANAGER',
    hourlyRateCzk: null,
    status: 'ACTIVE',
    company: companyB,
    user: managerB,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const employeeMembershipA = {
    id: 'membership-employee-a',
    companyId: companyA.id,
    userId: employee.id,
    role: 'EMPLOYEE',
    hourlyRateCzk: '250.00',
    status: 'ACTIVE',
    company: companyA,
    user: employee,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const sharedMembershipA = {
    id: 'membership-shared-a',
    companyId: companyA.id,
    userId: sharedEmployee.id,
    role: 'EMPLOYEE',
    hourlyRateCzk: '250.00',
    status: 'ACTIVE',
    company: companyA,
    user: sharedEmployee,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const sharedMembershipB = {
    id: 'membership-shared-b',
    companyId: companyB.id,
    userId: sharedEmployee.id,
    role: 'EMPLOYEE',
    hourlyRateCzk: '300.00',
    status: 'ACTIVE',
    company: companyB,
    user: sharedEmployee,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const projectA = {
    id: 'project-a',
    companyId: companyA.id,
    name: 'Site A',
    address: '',
    description: '',
    isActive: true,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const projectB = {
    id: 'project-b',
    companyId: companyB.id,
    name: 'Site B',
    address: '',
    description: '',
    isActive: true,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };

  return {
    companyA,
    companyB,
    managerA,
    managerB,
    employee,
    sharedEmployee,
    managerMembershipA,
    managerMembershipB,
    employeeMembershipA,
    sharedMembershipA,
    sharedMembershipB,
    projectA,
    projectB,
  };
}

function context(user, membership, memberships = [membership]) {
  return {
    user,
    activeMembership: membership,
    activeCompany: membership.company,
    memberships,
  };
}

test('company registration creates User, Company and MANAGER membership', async () => {
  const client = createFakeWorkTrackClient();
  const payload = await registerCompanyAccount(
    client,
    {
      firstName: 'Roman',
      lastName: 'Manager',
      email: 'roman@example.com',
      password: 'password123',
      companyName: 'Prime Work',
    },
    {
      issueAuthSession: fakeIssueAuthSession,
    }
  );

  assert.equal(client.state.users.length, 1);
  assert.equal(client.state.companies.length, 1);
  assert.equal(client.state.memberships.length, 1);
  assert.equal(client.state.memberships[0].role, 'MANAGER');
  assert.equal(client.state.memberships[0].companyId, client.state.companies[0].id);
  assert.equal(payload.user.role, 'MANAGER');
  assert.equal(payload.user.activeCompany.name, 'Prime Work');
  assert.equal(client.state.sessions.length, 1);
});

test('duplicate registration email does not create duplicate User', async () => {
  const existingUser = {
    id: 'user-existing',
    email: 'roman@example.com',
    name: 'Roman',
    firstName: 'Roman',
    lastName: '',
    passwordHash: 'hash',
    profile: {},
    deletedAt: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const client = createFakeWorkTrackClient({
    users: [existingUser],
  });

  await assert.rejects(
    () =>
      registerCompanyAccount(
        client,
        {
          firstName: 'Roman',
          lastName: 'Manager',
          email: 'roman@example.com',
          password: 'password123',
          companyName: 'Prime Work',
        },
        {
          issueAuthSession: fakeIssueAuthSession,
        }
      ),
    /User with this email already exists/
  );

  assert.equal(client.state.users.length, 1);
  assert.equal(client.state.companies.length, 0);
  assert.equal(client.state.memberships.length, 0);
});

test('manager creates employee membership only inside current company', async () => {
  const seed = createSeed();
  const client = createFakeWorkTrackClient({
    users: [seed.managerA],
    companies: [seed.companyA],
    memberships: [seed.managerMembershipA],
  });

  const employee = await createManagerEmployee(
    client,
    context(seed.managerA, seed.managerMembershipA),
    {
      firstName: 'Jane',
      lastName: 'Worker',
      email: 'jane@example.com',
      temporaryPassword: 'password123',
      hourlyRateCzk: '275',
    }
  );

  assert.equal(employee.companyId, seed.companyA.id);
  assert.equal(employee.role, 'EMPLOYEE');
  assert.equal(employee.hourlyRateCzk, '275.00');
  assert.equal(client.state.users.find(user => user.email === 'jane@example.com').mustChangePassword, true);
});

test('manager company A cannot see company B employees', async () => {
  const seed = createSeed();
  const client = createFakeWorkTrackClient({
    users: [seed.managerA, seed.managerB, seed.employee, seed.sharedEmployee],
    companies: [seed.companyA, seed.companyB],
    memberships: [
      seed.managerMembershipA,
      seed.managerMembershipB,
      seed.employeeMembershipA,
      seed.sharedMembershipB,
    ],
  });

  const result = await listManagerEmployees(
    client,
    context(seed.managerA, seed.managerMembershipA)
  );

  assert.deepEqual(
    result.employees.map(employee => employee.companyId),
    [seed.companyA.id]
  );
  assert.equal(result.employees.some(employee => employee.userId === seed.sharedEmployee.id), false);
});

test('manager can see and reactivate an inactive employee membership', async () => {
  const seed = createSeed();
  const inactiveMembership = {
    ...seed.employeeMembershipA,
    status: 'INACTIVE',
  };
  const client = createFakeWorkTrackClient({
    users: [seed.managerA, seed.employee],
    companies: [seed.companyA],
    memberships: [seed.managerMembershipA, inactiveMembership],
  });
  const managerContext = context(seed.managerA, seed.managerMembershipA);

  const before = await listManagerEmployees(client, managerContext);
  assert.equal(before.employees.length, 1);
  assert.equal(before.employees[0].status, 'INACTIVE');

  await updateEmployeeMembership(client, managerContext, inactiveMembership.id, {
    status: 'ACTIVE',
  });

  const after = await listManagerEmployees(client, managerContext);
  assert.equal(after.employees.length, 1);
  assert.equal(after.employees[0].status, 'ACTIVE');
});

test('employee company A sees only active projects from company A', async () => {
  const seed = createSeed();
  const inactiveProjectA = {
    ...seed.projectA,
    id: 'project-a-inactive',
    name: 'Old Site',
    isActive: false,
  };
  const client = createFakeWorkTrackClient({
    companies: [seed.companyA, seed.companyB],
    memberships: [seed.employeeMembershipA],
    projects: [seed.projectA, inactiveProjectA, seed.projectB],
  });

  const result = await listProjects(client, context(seed.employee, seed.employeeMembershipA));

  assert.deepEqual(
    result.projects.map(project => project.id),
    [seed.projectA.id]
  );
});

test('employee cannot create WorkEntry for another company project', async () => {
  const seed = createSeed();
  const client = createFakeWorkTrackClient({
    companies: [seed.companyA, seed.companyB],
    memberships: [seed.employeeMembershipA],
    projects: [seed.projectA, seed.projectB],
  });

  await assert.rejects(
    () =>
      createEmployeeWorkEntry(client, context(seed.employee, seed.employeeMembershipA), {
        workDate: '2026-08-17',
        hours: '8',
        projectId: seed.projectB.id,
      }),
    /Project not found/
  );
});

test('hourly rate belongs to CompanyMembership, not global User', async () => {
  const seed = createSeed();
  const client = createFakeWorkTrackClient({
    users: [seed.sharedEmployee],
    companies: [seed.companyA, seed.companyB],
    memberships: [seed.sharedMembershipA, seed.sharedMembershipB],
  });

  const userInCompanyA = await buildSanitizedUser(client, seed.sharedEmployee, {
    memberships: [seed.sharedMembershipA, seed.sharedMembershipB],
    activeMembership: seed.sharedMembershipA,
    activeCompany: seed.companyA,
  });
  const userInCompanyB = await buildSanitizedUser(client, seed.sharedEmployee, {
    memberships: [seed.sharedMembershipA, seed.sharedMembershipB],
    activeMembership: seed.sharedMembershipB,
    activeCompany: seed.companyB,
  });

  assert.equal(userInCompanyA.hourlyRateCzk, '250.00');
  assert.equal(userInCompanyB.hourlyRateCzk, '300.00');
});

test('sanitized login payload exposes correct role and company context', async () => {
  const seed = createSeed();
  const user = await buildSanitizedUser(null, seed.managerA, {
    memberships: [seed.managerMembershipA],
    activeMembership: seed.managerMembershipA,
    activeCompany: seed.companyA,
  });

  assert.equal(hasManagerAccess(user), true);
  assert.equal(hasEmployeeAccess(user), false);
  assert.equal(user.role, 'MANAGER');
  assert.equal(user.activeCompany.id, seed.companyA.id);
  assert.equal(user.activeMembership.id, seed.managerMembershipA.id);
});

test('WorkEntry and WeeklySubmission flow works after membership migration', async () => {
  const seed = createSeed();
  const client = createFakeWorkTrackClient({
    users: [seed.managerA, seed.employee],
    companies: [seed.companyA],
    memberships: [seed.managerMembershipA, seed.employeeMembershipA],
    projects: [seed.projectA],
  });

  await createEmployeeWorkEntry(client, context(seed.employee, seed.employeeMembershipA), {
    workDate: '2026-08-17',
    hours: '8',
    projectId: seed.projectA.id,
  });
  await createEmployeeWorkEntry(client, context(seed.employee, seed.employeeMembershipA), {
    workDate: '2026-08-18',
    hours: '4.50',
    projectId: seed.projectA.id,
  });

  const submitted = await submitEmployeeWeek(
    client,
    context(seed.employee, seed.employeeMembershipA),
    {
      weekStart: '2026-08-17',
    }
  );

  assert.equal(submitted.status, 'SUBMITTED');
  assert.equal(submitted.entries.length, 2);
  assert.equal(client.state.workEntries.every(entry => entry.status === 'SUBMITTED'), true);

  const queue = await listManagerSubmissions(
    client,
    context(seed.managerA, seed.managerMembershipA),
    {
      status: 'SUBMITTED',
    }
  );

  assert.equal(queue.submissions.length, 1);
  assert.equal(queue.submissions[0].employee.id, seed.employeeMembershipA.id);
  assert.equal(queue.submissions[0].summary.totalHours, '12.50');

  const approved = await reviewWeeklySubmission(
    client,
    context(seed.managerA, seed.managerMembershipA),
    submitted.id,
    'approve'
  );
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.reviewedByMembershipId, seed.managerMembershipA.id);
  assert.equal(client.state.workEntries.every(entry => entry.status === 'APPROVED'), true);

  const summary = await getEmployeeDashboardSummary(
    client,
    context(seed.employee, seed.employeeMembershipA),
    '2026-08-17'
  );
  assert.deepEqual(summary.summary, {
    totalHours: '12.50',
    approvedHours: '12.50',
    pendingHours: '0.00',
    confirmedSalaryCzk: '3125.00',
    predictedSalaryCzk: '0.00',
  });
});

test('submitted and approved entries remain locked', async () => {
  const seed = createSeed();
  const client = createFakeWorkTrackClient({
    users: [seed.managerA, seed.employee],
    companies: [seed.companyA],
    memberships: [seed.managerMembershipA, seed.employeeMembershipA],
    projects: [seed.projectA],
  });

  await createEmployeeWorkEntry(client, context(seed.employee, seed.employeeMembershipA), {
    workDate: '2026-08-17',
    hours: '8',
    projectId: seed.projectA.id,
  });
  const submitted = await submitEmployeeWeek(
    client,
    context(seed.employee, seed.employeeMembershipA),
    {
      weekStart: '2026-08-17',
    }
  );
  const entryId = submitted.entries[0].id;

  await assert.rejects(
    () =>
      updateEmployeeWorkEntry(client, context(seed.employee, seed.employeeMembershipA), entryId, {
        hours: '6',
        projectId: seed.projectA.id,
      }),
    /Work entry is locked/
  );
});

test('manager cannot approve another company submission', async () => {
  const seed = createSeed();
  const submission = {
    id: 'submission-b',
    companyId: seed.companyB.id,
    employeeMembershipId: seed.sharedMembershipB.id,
    reviewedByMembershipId: null,
    weekStart: new Date('2026-08-17T00:00:00.000Z'),
    weekEnd: new Date('2026-08-23T00:00:00.000Z'),
    status: 'SUBMITTED',
    submittedAt: BASE_DATE,
    reviewedAt: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
  const client = createFakeWorkTrackClient({
    users: [seed.managerA, seed.managerB, seed.sharedEmployee],
    companies: [seed.companyA, seed.companyB],
    memberships: [seed.managerMembershipA, seed.managerMembershipB, seed.sharedMembershipB],
    weeklySubmissions: [submission],
  });

  await assert.rejects(
    () =>
      reviewWeeklySubmission(
        client,
        context(seed.managerA, seed.managerMembershipA),
        submission.id,
        'approve'
      ),
    /Weekly submission not found/
  );
});
