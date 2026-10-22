// Called periodically for each open stream, without writing an HTTP response.
// A previously authenticated stream is not a permanent access grant.
export async function hasChatStreamAccess(client, identity, now = Date.now()) {
  const tokenExpiresAt = new Date(identity?.expiresAt).getTime();
  if (!identity?.sessionId || !identity.userId || !identity.membershipId ||
      !identity.companyId || !Number.isFinite(tokenExpiresAt) || tokenExpiresAt <= now)
    return false;
  const session = await client.session.findUnique({
    where: { id: identity.sessionId },
    select: { userId: true, expiresAt: true, user: { select: { deletedAt: true } } },
  });
  const sessionExpiresAt = new Date(session?.expiresAt).getTime();
  if (!session || session.userId !== identity.userId || !session.user ||
      session.user.deletedAt || !Number.isFinite(sessionExpiresAt) || sessionExpiresAt <= now)
    return false;
  const membership = await client.companyMembership.findFirst({
    where: {
      id: identity.membershipId,
      companyId: identity.companyId,
      userId: identity.userId,
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: { id: true },
  });
  return Boolean(membership);
}
