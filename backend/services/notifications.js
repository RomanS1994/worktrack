import { randomUUID } from 'node:crypto';

import { getVapidPublicKey, sendWebPush } from './web-push.js';

const PUSH_LANGUAGES = new Set(['uk', 'cs', 'en']);
const REVIEW_REJECTED_FALLBACK = 'Your manager rejected this week. Open it to make corrections.';

function getMembership(context) {
  const membership = context?.activeMembership;
  if (!membership?.id || !membership?.companyId || membership.status === 'INACTIVE') {
    throw new Error('Company access is required');
  }
  return membership;
}

function profileObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readPushSubscriptions(profile) {
  const value = profileObject(profile).pushSubscriptions;
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

function normalizePushLanguage(value) {
  const language = String(value || '').trim().toLowerCase();
  return PUSH_LANGUAGES.has(language) ? language : 'uk';
}

function cleanSubscription(body = {}) {
  const endpoint = String(body.endpoint || '').trim();
  const p256dh = String(body.keys?.p256dh || '').trim();
  const auth = String(body.keys?.auth || '').trim();
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    throw new Error('Invalid push subscription');
  }
  return { endpoint: endpoint.slice(0, 2048), keys: { p256dh, auth } };
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

function extractPeriod(message = '') {
  const match = String(message).match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  return match ? `${match[1]} – ${match[2]}` : '';
}

function extractInvoiceNumber(notification) {
  const match = String(notification?.title || '').match(/Invoice\s+([^\s]+)(?:\s|$)/i);
  return match?.[1] || '';
}

function submittedEmployeeName(notification) {
  const suffix = ' submitted a week';
  const title = String(notification?.title || '');
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title || 'Employee';
}

export function localizePushNotification(notification, rawLanguage = 'uk') {
  const language = normalizePushLanguage(rawLanguage);
  const payload = serializeNotification(notification);
  const type = String(notification?.type || '');
  if (language === 'en' || type === 'chat.message') return payload;

  const period = extractPeriod(notification?.message);
  if (type === 'weekly_submission.submitted') {
    const name = submittedEmployeeName(notification);
    return {
      ...payload,
      title: language === 'cs' ? `${name} odeslal(a) týden` : `${name} відправив(ла) тиждень`,
      message: period
        ? language === 'cs' ? `Zkontrolujte pracovní hodiny za období ${period}.` : `Перевірте робочі години за ${period}.`
        : language === 'cs' ? 'Týden je připraven ke kontrole.' : 'Тиждень готовий до перевірки.',
    };
  }

  if (type === 'weekly_submission.approved') {
    return {
      ...payload,
      title: language === 'cs' ? 'Týden byl schválen' : 'Тиждень погоджено',
      message: language === 'cs'
        ? `Vaše práce za období ${period || '—'} byla schválena.`
        : `Ваші години за ${period || '—'} погоджено.`,
    };
  }

  if (type === 'weekly_submission.rejected') {
    const customReason = String(notification?.message || '');
    return {
      ...payload,
      title: language === 'cs' ? 'Týden vyžaduje úpravy' : 'Потрібні зміни в тижні',
      message: customReason && customReason !== REVIEW_REJECTED_FALLBACK
        ? customReason
        : language === 'cs'
          ? 'Manažer tento týden zamítl. Otevřete ho, proveďte opravy a odešlete znovu.'
          : 'Менеджер відхилив цей тиждень. Відкрийте його, внесіть виправлення та відправте повторно.',
    };
  }

  if (type === 'weekly_submission.reopened') {
    return {
      ...payload,
      title: language === 'cs' ? 'Schválení bylo zrušeno' : 'Погодження скасовано',
      message: language === 'cs'
        ? `Vaše práce za období ${period || '—'} byla vrácena ke kontrole.`
        : `Ваші години за ${period || '—'} повернено на перевірку.`,
    };
  }

  if (type.startsWith('invoice.')) {
    const number = extractInvoiceNumber(notification) || '—';
    if (type === 'invoice.sent') {
      return {
        ...payload,
        title: language === 'cs' ? `Přijata faktura ${number}` : `Отримано фактуру ${number}`,
        message: notification.message,
      };
    }
    if (type === 'invoice.cancelled') {
      return {
        ...payload,
        title: language === 'cs' ? `Faktura ${number} byla zrušena` : `Фактуру ${number} скасовано`,
        message: language === 'cs' ? 'Pracovník tuto fakturu zrušil.' : 'Працівник скасував цю фактуру.',
      };
    }
    if (type === 'invoice.viewed') {
      return {
        ...payload,
        title: language === 'cs' ? `Faktura ${number} byla zobrazena` : `Фактуру ${number} переглянуто`,
        message: language === 'cs' ? 'Zaměstnavatel otevřel vaši fakturu.' : 'Роботодавець відкрив вашу фактуру.',
      };
    }
    if (type === 'invoice.paid') {
      const amount = String(notification.message || '').replace(' was marked as paid.', '');
      return {
        ...payload,
        title: language === 'cs' ? `Faktura ${number} byla zaplacena` : `Фактуру ${number} оплачено`,
        message: language === 'cs' ? `${amount} bylo označeno jako zaplacené.` : `${amount} позначено як оплачено.`,
      };
    }
  }

  return payload;
}

async function activeNotificationRecipient(client, payload) {
  if (!payload?.recipientMembershipId || !payload?.companyId) return null;
  if (typeof client.companyMembership?.findFirst !== 'function') {
    return { id: payload.recipientMembershipId };
  }
  return client.companyMembership.findFirst({
    where: {
      id: payload.recipientMembershipId,
      companyId: payload.companyId,
      status: 'ACTIVE',
      deletedAt: null,
      user: { is: { deletedAt: null } },
    },
    select: { id: true },
  });
}

async function pruneExpiredPushSubscriptions(client, membership, expiredEndpoints) {
  if (!membership?.userId || !expiredEndpoints?.size) return;

  const user = await client.user.findUnique({
    where: { id: membership.userId },
    select: { profile: true },
  });
  if (!user) return;

  const profile = profileObject(user.profile);
  const existing = readPushSubscriptions(profile);
  const next = existing.filter(item => !(
    expiredEndpoints.has(item.endpoint)
    && item.membershipId === membership.id
    && item.companyId === membership.companyId
  ));
  if (next.length === existing.length) return;

  await client.user.update({
    where: { id: membership.userId },
    data: { profile: { ...profile, pushSubscriptions: next } },
  });
}

async function deliverPush(client, notification) {
  try {
    const membership = await client.companyMembership.findUnique({
      where: { id: notification.recipientMembershipId },
      select: {
        id: true,
        companyId: true,
        userId: true,
        user: { select: { profile: true } },
      },
    });
    if (!membership) return;

    const subscriptions = readPushSubscriptions(membership.user?.profile)
      .filter(item => item.membershipId === membership.id && item.companyId === membership.companyId);
    if (!subscriptions.length) return;

    const results = await Promise.allSettled(
      subscriptions.map(subscription =>
        sendWebPush(subscription, localizePushNotification(notification, subscription.language)),
      ),
    );
    const expiredEndpoints = new Set();

    results.forEach((result, index) => {
      if (result.status !== 'fulfilled') return;
      if (result.value?.expired) expiredEndpoints.add(subscriptions[index]?.endpoint);
    });

    if (expiredEndpoints.size) {
      await pruneExpiredPushSubscriptions(client, membership, expiredEndpoints);
    }
  } catch (error) {
    console.warn('Web Push delivery failed:', error instanceof Error ? error.message : String(error));
  }
}

export async function createNotification(client, payload) {
  const recipient = await activeNotificationRecipient(client, payload);
  if (!recipient) return null;

  const notification = await client.notification.create({
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

  await deliverPush(client, notification);
  return notification;
}

export async function getPushSettings(client, context) {
  const membership = getMembership(context);
  const user = await client.user.findUnique({ where: { id: membership.userId }, select: { profile: true } });
  const subscriptions = readPushSubscriptions(user?.profile)
    .filter(item => item.membershipId === membership.id && item.companyId === membership.companyId);
  return {
    publicKey: getVapidPublicKey(),
    subscriptionCount: subscriptions.length,
  };
}

export async function savePushSubscription(client, context, body, userAgent = '') {
  const membership = getMembership(context);
  const subscription = cleanSubscription(body);
  const user = await client.user.findUnique({ where: { id: membership.userId }, select: { profile: true } });
  const profile = profileObject(user?.profile);
  const existing = readPushSubscriptions(profile);
  const next = existing.filter(item => item.endpoint !== subscription.endpoint);
  next.push({
    ...subscription,
    membershipId: membership.id,
    companyId: membership.companyId,
    language: normalizePushLanguage(body?.language),
    userAgent: String(userAgent || '').slice(0, 300),
    updatedAt: new Date().toISOString(),
  });

  await client.user.update({
    where: { id: membership.userId },
    data: { profile: { ...profile, pushSubscriptions: next.slice(-8) } },
  });
  return { ok: true, subscriptionCount: next.filter(item => item.membershipId === membership.id).length };
}

export async function deletePushSubscription(client, context, endpoint) {
  const membership = getMembership(context);
  const cleanEndpoint = String(endpoint || '').trim();
  const user = await client.user.findUnique({ where: { id: membership.userId }, select: { profile: true } });
  const profile = profileObject(user?.profile);
  const next = readPushSubscriptions(profile).filter(item => !(
    item.endpoint === cleanEndpoint && item.membershipId === membership.id
  ));
  await client.user.update({
    where: { id: membership.userId },
    data: { profile: { ...profile, pushSubscriptions: next } },
  });
  return { ok: true };
}

export async function notifyManagersAboutSubmission(client, context, submission) {
  const employeeMembership = getMembership(context);
  const managers = await client.companyMembership.findMany({
    where: {
      companyId: employeeMembership.companyId,
      id: { not: employeeMembership.id },
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
      ? submission.rejectionReason || REVIEW_REJECTED_FALLBACK
      : `Your work for ${submission.weekStart} - ${submission.weekEnd} was approved.`,
    href: `/hours?date=${submission.weekStart}`,
  });
}

export async function notifyEmployeeApprovalReopened(client, context, submission) {
  const managerMembership = getMembership(context);
  await createNotification(client, {
    companyId: managerMembership.companyId,
    recipientMembershipId: submission.employeeMembershipId,
    type: 'weekly_submission.reopened',
    title: 'Approval cancelled',
    message: `Your work for ${submission.weekStart} - ${submission.weekEnd} was returned to review.`,
    href: `/hours?date=${submission.weekStart}`,
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
