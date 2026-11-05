import { createNotification } from './notifications.js';

export async function notifyCompanyAboutChatMessage(client, context, message) {
  const membership = context?.activeMembership;
  if (!membership?.companyId || !membership?.id || !message?.id) return;

  const roomMembers = await client.$queryRaw`
    SELECT rm.membership_id AS id
      FROM chat_room_members rm
      JOIN company_memberships cm ON cm.id = rm.membership_id
     WHERE rm.room_id = ${message.roomId}
       AND rm.left_at IS NULL AND cm.status = 'ACTIVE' AND cm."deletedAt" IS NULL
       AND cm.id <> ${membership.id}`;
  const recipientIds = roomMembers.map(row => row.id);
  if (!recipientIds.length) return;
  const recipients = await client.companyMembership.findMany({
    where: {
      companyId: membership.companyId,
      status: 'ACTIVE',
      deletedAt: null,
      id: { in: recipientIds },
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
        href: `/chat?roomId=${encodeURIComponent(message.roomId)}&messageId=${encodeURIComponent(message.id)}`,
      })
    )
  );
}
