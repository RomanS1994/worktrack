import { sendWebPush } from './web-push.js';

function profileObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readPushSubscriptions(profile) {
  const value = profileObject(profile).pushSubscriptions;
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

export async function notifyCompanyAboutChatMessage(client, context, message) {
  const membership = context?.activeMembership;
  if (!membership?.companyId || !message?.id) return;

  const recipients = await client.companyMembership.findMany({
    where: {
      companyId: membership.companyId,
      status: 'ACTIVE',
      deletedAt: null,
      id: { not: membership.id },
      user: { is: { deletedAt: null } },
    },
    select: {
      id: true,
      companyId: true,
      user: { select: { profile: true } },
    },
  });

  const title = message.author?.name || context?.user?.name || 'WorkTrack';
  const payload = {
    id: `chat:${message.id}`,
    companyId: membership.companyId,
    recipientMembershipId: '',
    type: 'chat.message',
    title,
    message: String(message.body || '').slice(0, 180),
    href: '/chat',
    readAt: '',
    createdAt: message.createdAt || new Date().toISOString(),
  };

  const deliveries = [];
  for (const recipient of recipients) {
    const subscriptions = readPushSubscriptions(recipient.user?.profile)
      .filter(item => item.membershipId === recipient.id && item.companyId === recipient.companyId);
    for (const subscription of subscriptions) {
      deliveries.push(sendWebPush(subscription, { ...payload, recipientMembershipId: recipient.id }));
    }
  }

  await Promise.allSettled(deliveries);
}
