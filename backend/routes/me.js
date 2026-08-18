import { getAuthContext } from '../auth/context.js';
import { hashPassword, verifyPassword } from '../auth/tokens.js';
import { buildSanitizedUser, createAuditLog } from '../db/prisma-helpers.js';
import { prisma } from '../db/prisma.js';
import { runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import { normalizePhoneNumber, normalizeText, nowIso } from '../validation/common.js';

function normalizeProfile(value) {
  return value && typeof value === 'object' ? value : {};
}

function splitDisplayName(name) {
  const parts = normalizeText(name).split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || '';

  return {
    firstName,
    lastName: parts.join(' '),
  };
}

async function handleDeleteMe(request, response) {
  const context = await getAuthContext(request, response);
  if (!context) return;

  await runStoreTransaction({
    prisma: async tx => {
      const deletedAt = new Date(nowIso());

      await createAuditLog(tx, {
        action: 'user.deleted_self',
        actorUserId: context.user.id,
        targetUserId: context.user.id,
        entityType: 'user',
        entityId: context.user.id,
        before: {
          deletedAt: context.user.deletedAt,
        },
        after: {
          deletedAt: deletedAt.toISOString(),
        },
      });

      await tx.session.deleteMany({
        where: {
          userId: context.user.id,
        },
      });

      await tx.user.update({
        where: {
          id: context.user.id,
        },
        data: {
          deletedAt,
          updatedAt: deletedAt,
        },
      });
    },
  });

  sendJson(response, 200, { ok: true });
}

async function handleUpdateMyProfile(request, response) {
  const context = await getAuthContext(request, response);
  if (!context) return;

  const body = await readJsonBody(request);
  const requestedName = normalizeText(body.name) || context.user.name;
  const requestedFirstName = normalizeText(body.firstName);
  const requestedLastName = normalizeText(body.lastName);
  const nameParts = splitDisplayName(requestedName);
  const hasPhoneInput = Object.prototype.hasOwnProperty.call(body, 'phone');
  const nextPhone = hasPhoneInput ? normalizePhoneNumber(body.phone) : context.user.phone || '';
  const nextProfile = {
    ...normalizeProfile(context.user.profile),
    ...normalizeProfile(body.profile),
  };

  const user = await runStoreTransaction({
    prisma: async tx => {
      if (hasPhoneInput && nextPhone) {
        const existingPhoneUser = await tx.user.findFirst({
          where: {
            phone: nextPhone,
            id: {
              not: context.user.id,
            },
          },
          select: {
            id: true,
          },
        });

        if (existingPhoneUser) {
          throw new Error('Phone number is already used');
        }
      }

      const updatedUser = await tx.user.update({
        where: {
          id: context.user.id,
        },
        data: {
          name: requestedName,
          firstName: requestedFirstName || nameParts.firstName,
          lastName: requestedLastName || nameParts.lastName,
          ...(hasPhoneInput ? { phone: nextPhone || null } : {}),
          profile: nextProfile,
          updatedAt: new Date(nowIso()),
        },
      });

      await createAuditLog(tx, {
        action: 'user.profile.updated',
        actorUserId: context.user.id,
        targetUserId: updatedUser.id,
        entityType: 'profile',
        entityId: updatedUser.id,
        before: {
          name: context.user.name,
          phone: context.user.phone || '',
          profile: context.user.profile,
        },
        after: {
          name: updatedUser.name,
          phone: updatedUser.phone || '',
          profile: updatedUser.profile,
        },
      });

      return buildSanitizedUser(tx, updatedUser);
    },
  });

  sendJson(response, 200, { user });
}

async function handleChangeMyPassword(request, response) {
  const context = await getAuthContext(request, response);
  if (!context) return;

  const body = await readJsonBody(request);
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');

  if (!currentPassword) {
    throw new Error('Current password is required');
  }

  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }

  if (!verifyPassword(currentPassword, context.user.passwordHash)) {
    throw new Error('Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new Error('New password must be different');
  }

  const user = await runStoreTransaction({
    prisma: async tx => {
      const updatedAt = new Date(nowIso());
      const updatedUser = await tx.user.update({
        where: {
          id: context.user.id,
        },
        data: {
          passwordHash: hashPassword(newPassword),
          mustChangePassword: false,
          updatedAt,
        },
      });

      await tx.session.deleteMany({
        where: {
          userId: context.user.id,
          id: {
            not: context.session.id,
          },
        },
      });

      await createAuditLog(tx, {
        action: 'user.password.changed',
        actorUserId: context.user.id,
        targetUserId: context.user.id,
        entityType: 'user',
        entityId: context.user.id,
        before: {
          mustChangePassword: Boolean(context.user.mustChangePassword),
        },
        after: {
          mustChangePassword: false,
        },
      });

      return buildSanitizedUser(tx, updatedUser, {
        memberships: context.memberships,
        activeMembership: context.activeMembership,
        activeCompany: context.activeCompany,
      });
    },
  });

  sendJson(response, 200, { user });
}

export async function handleMeRoutes(request, response, { pathName }) {
  if (request.method === 'GET' && pathName === '/api/me') {
    const context = await getAuthContext(request, response);
    if (!context) return true;

    const user = await buildSanitizedUser(prisma, context.user, {
      memberships: context.memberships,
      activeMembership: context.activeMembership,
      activeCompany: context.activeCompany,
    });
    sendJson(response, 200, { user });
    return true;
  }

  if (request.method === 'PATCH' && pathName === '/api/me/profile') {
    await handleUpdateMyProfile(request, response);
    return true;
  }

  if (request.method === 'PATCH' && pathName === '/api/me/password') {
    await handleChangeMyPassword(request, response);
    return true;
  }

  if (request.method === 'DELETE' && pathName === '/api/me') {
    await handleDeleteMe(request, response);
    return true;
  }

  return false;
}
