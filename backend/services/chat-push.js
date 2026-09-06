import { createNotification } from './notifications.js';

export async function notifyCompanyAboutChatMessage(client, context, message) {
  const membership = context?.activeMembership;
  if (!membership?.companyId || !membership?.id || !message?.id) return;

  const recipients = await client.companyMembership.findMany({
    where: {
      companyId: membership.companyId,
      status: 'ACTIVE',
      deletedAt: null,
      id: { not: membership.id },
      user: { is: { deletedAt: null } },
    },
    select: { id: true },
  });

  const title = message.author?.name || context?.user?.name || 'WorkTrack';
  const body = String(message.body || '').slice(0, 180);

  await Promise.all(
    recipients.map(recipient =>
      createNotification(client, {
        companyId: membership.companyId,
        recipientMembershipId: recipient.id,
        type: 'chat.message',
        title,
        message: body,
        href: '/chat',
      })
    )
  );
}
