import { randomUUID } from 'node:crypto';

import { hashPassword } from '../auth/tokens.js';
import { buildSanitizedUser, createAuditLog } from '../db/prisma-helpers.js';
import { validateCompanyRegistrationInput } from '../validation/auth.js';
import { normalizeText, nowIso } from '../validation/common.js';

function slugifyCompanyName(value) {
  const slug = normalizeText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || `company-${randomUUID().slice(0, 8)}`;
}

async function buildUniqueCompanySlug(client, companyName) {
  const baseSlug = slugifyCompanyName(companyName);
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await client.company.findUnique({
      where: {
        slug: candidate,
      },
      select: {
        id: true,
      },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function registerCompanyAccount(
  client,
  body,
  {
    issueAuthSession,
    requestMeta = {},
  } = {}
) {
  if (typeof issueAuthSession !== 'function') {
    throw new Error('Auth session factory is required');
  }

  const input = validateCompanyRegistrationInput(body);
  const existingUser = await client.user.findUnique({
    where: {
      email: input.email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  const timestamp = new Date(nowIso());
  const userId = randomUUID();
  const companyId = randomUUID();
  const membershipId = randomUUID();
  const authSession = issueAuthSession(userId);
  const companySlug = await buildUniqueCompanySlug(client, input.companyName);

  const user = await client.user.create({
    data: {
      id: userId,
      name: input.name,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: hashPassword(input.password),
      profile: {},
      mustChangePassword: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      sessions: {
        create: {
          id: authSession.session.id,
          tokenHash: authSession.session.tokenHash,
          createdAt: new Date(authSession.session.createdAt),
          expiresAt: new Date(authSession.session.expiresAt),
        },
      },
    },
  });

  const company = await client.company.create({
    data: {
      id: companyId,
      name: input.companyName,
      slug: companySlug,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });

  const membership = await client.companyMembership.create({
    data: {
      id: membershipId,
      companyId,
      userId,
      role: 'MANAGER',
      hourlyRateCzk: null,
      status: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    include: {
      company: true,
    },
  });

  await createAuditLog(client, {
    action: 'company.registered',
    actorUserId: user.id,
    targetUserId: user.id,
    entityType: 'company',
    entityId: company.id,
    after: {
      companyId: company.id,
      membershipId: membership.id,
      role: membership.role,
    },
    meta: requestMeta,
  });

  return {
    refreshToken: authSession.refreshToken,
    token: authSession.accessToken,
    accessTokenExpiresAt: authSession.accessTokenExpiresAt,
    user: await buildSanitizedUser(client, user, {
      memberships: [membership],
      activeMembership: membership,
      activeCompany: company,
    }),
  };
}
