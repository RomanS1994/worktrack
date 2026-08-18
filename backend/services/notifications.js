import { randomUUID } from 'node:crypto';

function getMembership(context) {
  const membership = context?.activeMembership;
  if (!membership?.id || !membership?.companyId || membership.status === 'INACTIVE') {
    throw new Error('Company access is required');
  }
  return membership;
}

function serializeNotification(notification) {
  return {
    id: notification.id,
    companyId: notification.companyId,
    recipientMembershipId: notification.recipientMembershipId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    href: notification.href || '',
    readAt: notification.readAt ? notification.readAt.toISOString() : '',
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function createNotification(client, payload) {
  return client.notification.create({
    data: {
      id: randomUUID(),
      companyId: payload.companyId,
      recipientMembershipId: payload.recipientMembershipId,
      type: String(payload.type || 'system').slice(0, 80),
      title: String(payload.title || 'WorkTrack').slice(0, 160),
      message: String(payload.message || '').slice(0, 500),
      href: payload.href ? String(payload.href).slice(0, 300) : null,
      readAt: null,
    },
  });
}

export async function notifyManagersAboutSubmission(client, context, submission) {
  const employeeMembership = getMembership(context);
  const managers = await client.companyMembership.findMany({
    where: {
      companyId: employeeMembership.companyId,
      role: 'MANAGER',
      status: 'ACTIVE',
      user: { is: { deletedAt: null } },
    },
    select: { id: true },
  });

  const employeeName =
    submission?.employee?.name || submission?.employee?.email || context?.user?.name || 'Employee';
  const period = `${submission?.weekStart || ''} - ${submission?.weekEnd || ''}`;

  await Promise.all(
    managers.map(manager =>
      createNotification(client, {
        companyId: employeeMembership.companyId,
        recipientMembershipId: manager.id,
        type: 'weekly_submission.submitted',
        title: `${employeeName} submitted a week`,
        message: period ? `Review work hours for ${period}.` : 'A weekly submission is ready for review.',
        href: '/approvals',
      })
    )
  );
}

export async function notifyEmployeeAboutReview(client, context, submission) {
  const managerMembership = getMembership(context);
  const isRejected = submission?.status === 'REJECTED';

  await createNotification(client, {
    companyId: managerMembership.companyId,
    recipientMembershipId: submission.employeeMembershipId,
    type: isRejected ? 'weekly_submission.rejected' : 'weekly_submission.approved',
    title: isRejected ? 'Week needs changes' : 'Week approved',
    message: isRejected
      ? submission.rejectionReason || 'Your manager rejected this week. Open it to make corrections.'
      : `Your work for ${submission.weekStart} - ${submission.weekEnd} was approved.`,
    href: `/hours?weekStart=${submission.weekStart}`,
  });
}

export async function listNotifications(client, context) {
  const membership = getMembership(context);
  const notifications = await client.notification.findMany({
    where: {
      companyId: membership.companyId,
      recipientMembershipId: membership.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return {
    unreadCount: notifications.filter(notification => !notification.readAt).length,
    notifications: notifications.map(serializeNotification),
  };
}

export async function markNotificationRead(client, context, notificationId) {
  const membership = getMembership(context);
  const notification = await client.notification.findFirst({
    where: {
      id: notificationId,
      companyId: membership.companyId,
      recipientMembershipId: membership.id,
    },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  const updated = await client.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt || new Date() },
  });

  return serializeNotification(updated);
}

export async function markAllNotificationsRead(client, context) {
  const membership = getMembership(context);
  const result = await client.notification.updateMany({
    where: {
      companyId: membership.companyId,
      recipientMembershipId: membership.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { ok: true, updatedCount: result.count };
}
