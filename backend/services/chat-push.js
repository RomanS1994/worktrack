import { createNotification } from './notifications.js';

export async function notifyCompanyAboutChatMessage(client, context, message, { durable = false } = {}) {
  const membership = context?.activeMembership;
  if (!membership?.companyId || !membership?.id || !message?.id) return;

  const recipients = await client.companyMembership.findMany({
    where: {
      companyId: membership.companyId,
      status: 'ACTIVE',
      deletedAt: null,
      id: { not: membership.id },
      user: { is: { deletedAt: null } },
      ...(durable && message.createdAt ? { createdAt: { lte: new Date(message.createdAt) } } : {}),
    },
    select: { id: true },
  });

  const title = message.author?.name || context?.user?.name || 'WorkTrack';
  const body = String(message.body || '').slice(0, 180);

  // Bound fan-out concurrency so one large company cannot exhaust the DB pool.
  for (let offset = 0; offset < recipients.length; offset += 8) {
    const results = await Promise.allSettled(recipients.slice(offset, offset + 8).map(recipient =>
      createNotification(client, {
        companyId: membership.companyId,
        recipientMembershipId: recipient.id,
        type: 'chat.message',
        title,
        message: body,
        href: '/chat',
        ...(durable ? {
          deduplicationKey: JSON.stringify(['chat.message', message.id, recipient.id]),
          retryPush: true,
          nativeMessageId: message.id,
        } : {}),
      })
    ));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
}
