import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNotification,
  listNotifications,
  localizePushNotification,
  markNotificationRead,
  notifyEmployeeAboutReview,
  notifyEmployeeApprovalReopened,
  notifyManagersAboutSubmission,
  savePushSubscription,
} from '../services/notifications.js';

function context(overrides = {}) {
  return {
    user: { id: 'employee-user-1', name: 'Anna Novak' },
    activeMembership: {
      id: 'employee-membership-1',
      userId: 'employee-user-1',
      companyId: 'company-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      ...overrides,
    },
  };
}

function notification(overrides = {}) {
  return {
    id: 'notification-1',
    companyId: 'company-1',
    recipientMembershipId: 'employee-membership-1',
    type: 'weekly_submission.approved',
    title: 'Week approved',
    message: 'Your work for 2026-08-17 - 2026-08-23 was approved.',
    href: '/hours?date=2026-08-17',
    readAt: null,
    createdAt: new Date('2026-08-18T10:00:00.000Z'),
    ...overrides,
  };
}

test('notification list is scoped to the active company membership', async () => {
  let where = null;
  const client = {
    notification: {
      findMany: async query => {
        where = query.where;
        return [notification({ message: 'Approved', href: '/hours' })];
      },
    },
  };

  const result = await listNotifications(client, context());

  assert.deepEqual(where, {
    companyId: 'company-1',
    recipientMembershipId: 'employee-membership-1',
  });
  assert.equal(result.unreadCount, 1);
  assert.equal(result.notifications[0].id, 'notification-1');
});

test('employee submission notifies only active managers in the same company', async () => {
  let managerQuery = null;
  const created = [];
  const client = {
    companyMembership: {
      findMany: async query => {
        managerQuery = query;
        return [{ id: 'manager-1' }, { id: 'manager-2' }];
      },
    },
    notification: {
      create: async query => {
        created.push(query.data);
        return query.data;
      },
    },
  };

  await notifyManagersAboutSubmission(client, context(), {
    weekStart: '2026-08-17',
    weekEnd: '2026-08-23',
    employee: { name: 'Anna Novak' },
  });

  assert.equal(managerQuery.where.companyId, 'company-1');
  assert.equal(managerQuery.where.role, 'MANAGER');
  assert.equal(managerQuery.where.status, 'ACTIVE');
  assert.equal(created.length, 2);
  assert.deepEqual(created.map(item => item.recipientMembershipId), ['manager-1', 'manager-2']);
  assert.ok(created.every(item => item.companyId === 'company-1'));
  assert.ok(created.every(item => item.href === '/approvals'));
});

test('notification creation skips inactive or deleted recipients', async () => {
  let recipientWhere = null;
  let createCalls = 0;
  const client = {
    companyMembership: {
      findFirst: async query => {
        recipientWhere = query.where;
        return null;
      },
    },
    notification: {
      create: async () => {
        createCalls += 1;
        return null;
      },
    },
  };

  const result = await createNotification(client, {
    companyId: 'company-1',
    recipientMembershipId: 'deleted-manager-1',
    type: 'invoice.sent',
    title: 'Invoice received',
    message: 'Test',
    href: '/manager/invoices',
  });

  assert.equal(result, null);
  assert.equal(createCalls, 0);
  assert.deepEqual(recipientWhere, {
    id: 'deleted-manager-1',
    companyId: 'company-1',
    status: 'ACTIVE',
    deletedAt: null,
    user: { is: { deletedAt: null } },
  });
});

test('manager review notification opens the reviewed week in Hours', async () => {
  let created = null;
  const client = {
    notification: {
      create: async query => {
        created = query.data;
        return query.data;
      },
    },
  };

  await notifyEmployeeAboutReview(
    client,
    context({ id: 'manager-membership-1', role: 'MANAGER' }),
    {
      employeeMembershipId: 'employee-membership-1',
      status: 'REJECTED',
      rejectionReason: 'Please correct Friday.',
      weekStart: '2026-08-17',
      weekEnd: '2026-08-23',
    },
  );

  assert.equal(created.companyId, 'company-1');
  assert.equal(created.recipientMembershipId, 'employee-membership-1');
  assert.equal(created.href, '/hours?date=2026-08-17');
});

test('reopened approval notifies the employee and opens the affected week', async () => {
  let created = null;
  const client = {
    notification: {
      create: async query => {
        created = query.data;
        return query.data;
      },
    },
  };

  await notifyEmployeeApprovalReopened(
    client,
    context({ id: 'manager-membership-1', role: 'MANAGER' }),
    {
      employeeMembershipId: 'employee-membership-1',
      weekStart: '2026-08-17',
      weekEnd: '2026-08-23',
    },
  );

  assert.equal(created.companyId, 'company-1');
  assert.equal(created.recipientMembershipId, 'employee-membership-1');
  assert.equal(created.type, 'weekly_submission.reopened');
  assert.equal(created.href, '/hours?date=2026-08-17');
});

test('push notification copy is localized per device language', () => {
  const approvedUk = localizePushNotification(notification(), 'uk');
  assert.equal(approvedUk.title, 'Тиждень погоджено');
  assert.equal(approvedUk.message, 'Ваші години за 2026-08-17 – 2026-08-23 погоджено.');

  const reopenedCs = localizePushNotification(notification({
    type: 'weekly_submission.reopened',
    title: 'Approval cancelled',
    message: 'Your work for 2026-08-17 - 2026-08-23 was returned to review.',
  }), 'cs');
  assert.equal(reopenedCs.title, 'Schválení bylo zrušeno');
  assert.equal(reopenedCs.message, 'Vaše práce za období 2026-08-17 – 2026-08-23 byla vrácena ke kontrole.');

  const invoiceUk = localizePushNotification(notification({
    type: 'invoice.viewed',
    title: 'Invoice WT-2026-0001 viewed',
    message: 'Your employer opened the invoice.',
    href: '/invoices',
  }), 'uk');
  assert.equal(invoiceUk.title, 'Фактуру WT-2026-0001 переглянуто');
  assert.equal(invoiceUk.message, 'Роботодавець відкрив вашу фактуру.');
});

test('push localization preserves chat content and custom rejection reason', () => {
  const chat = localizePushNotification(notification({
    type: 'chat.message',
    title: 'Anna Novak',
    message: 'Ahoj, zítra v 7:00?',
    href: '/chat',
  }), 'uk');
  assert.equal(chat.title, 'Anna Novak');
  assert.equal(chat.message, 'Ahoj, zítra v 7:00?');

  const rejected = localizePushNotification(notification({
    type: 'weekly_submission.rejected',
    title: 'Week needs changes',
    message: 'Prosím oprav pátek.',
  }), 'uk');
  assert.equal(rejected.title, 'Потрібні зміни в тижні');
  assert.equal(rejected.message, 'Prosím oprav pátek.');
});

test('push subscription stores normalized device language', async () => {
  let updatedProfile = null;
  const client = {
    user: {
      findUnique: async () => ({ profile: {} }),
      update: async query => {
        updatedProfile = query.data.profile;
        return query.data;
      },
    },
  };

  await savePushSubscription(client, context(), {
    endpoint: 'https://push.example/subscription-1',
    keys: { p256dh: 'key', auth: 'auth' },
    language: 'cs',
  }, 'Test Browser');

  assert.equal(updatedProfile.pushSubscriptions.length, 1);
  assert.equal(updatedProfile.pushSubscriptions[0].language, 'cs');
  assert.equal(updatedProfile.pushSubscriptions[0].membershipId, 'employee-membership-1');
});

test('mark read cannot target a notification outside the active membership', async () => {
  let lookupWhere = null;
  const client = {
    notification: {
      findFirst: async query => {
        lookupWhere = query.where;
        return null;
      },
    },
  };

  await assert.rejects(markNotificationRead(client, context(), 'other-notification'), /Notification not found/);
  assert.deepEqual(lookupWhere, {
    id: 'other-notification',
    companyId: 'company-1',
    recipientMembershipId: 'employee-membership-1',
  });
});

test('inactive memberships cannot access notifications', async () => {
  await assert.rejects(
    listNotifications({ notification: { findMany: async () => [] } }, context({ status: 'INACTIVE' })),
    /Company access is required/
  );
});
