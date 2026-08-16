import { randomUUID } from 'node:crypto';

import { normalizeText, nowIso } from '../validation/common.js';

function toIsoString(value) {
  if (!value) return '';

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString();
}

function normalizeProfile(profile) {
  return profile && typeof profile === 'object' ? profile : {};
}

function serializeCompany(company) {
  if (!company) return null;

  return {
    id: company.id,
    name: normalizeText(company.name),
    slug: normalizeText(company.slug),
    createdAt: toIsoString(company.createdAt),
    updatedAt: toIsoString(company.updatedAt),
  };
}

function serializeMembership(membership) {
  if (!membership) return null;

  return {
    id: membership.id,
    companyId: membership.companyId,
    userId: membership.userId,
    role: membership.role,
    hourlyRateCzk: membership.hourlyRateCzk == null ? '' : String(membership.hourlyRateCzk),
    status: membership.status,
    company: serializeCompany(membership.company),
    createdAt: toIsoString(membership.createdAt),
    updatedAt: toIsoString(membership.updatedAt),
  };
}

async function loadUserMemberships(client, user) {
  if (Array.isArray(user?.memberships)) {
    return user.memberships;
  }

  if (!client?.companyMembership?.findMany || !user?.id) {
    return [];
  }

  return client.companyMembership.findMany({
    where: {
      userId: user.id,
      status: 'ACTIVE',
    },
    include: {
      company: true,
    },
    orderBy: [
      {
        createdAt: 'asc',
      },
    ],
  });
}

export async function createAuditLog(client, payload) {
  return client.auditLog.create({
    data: {
      id: randomUUID(),
      action: normalizeText(payload.action) || 'system.event',
      actorUserId: payload.actorUserId || null,
      targetUserId: payload.targetUserId || null,
      entityType: normalizeText(payload.entityType) || 'system',
      entityId: payload.entityId || null,
      before: payload.before ?? null,
      after: payload.after ?? null,
      meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
      createdAt: new Date(nowIso()),
    },
  });
}

export async function buildSanitizedUser(client, user, options = {}) {
  const memberships = options.memberships || (await loadUserMemberships(client, user));
  const activeMembership =
    options.activeMembership ||
    memberships.find(membership => membership.companyId === options.activeCompanyId) ||
    memberships[0] ||
    null;
  const activeCompany = options.activeCompany || activeMembership?.company || null;
  const serializedActiveMembership = serializeMembership(activeMembership);

  return {
    id: user.id,
    email: user.email,
    firstName: normalizeText(user.firstName),
    lastName: normalizeText(user.lastName),
    name: normalizeText(user.name),
    phone: user.phone || '',
    role: serializedActiveMembership?.role || user.role || '',
    companyId: serializedActiveMembership?.companyId || '',
    activeCompany: serializeCompany(activeCompany),
    activeMembership: serializedActiveMembership,
    memberships: memberships.map(serializeMembership).filter(Boolean),
    hourlyRateCzk:
      serializedActiveMembership?.hourlyRateCzk ||
      (user.hourlyRateCzk == null ? '' : String(user.hourlyRateCzk)),
    managerId: user.managerId || '',
    mustChangePassword: Boolean(user.mustChangePassword),
    profile: normalizeProfile(user.profile),
    deletedAt: toIsoString(user.deletedAt),
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}
