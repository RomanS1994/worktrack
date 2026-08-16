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

export async function buildSanitizedUser(_client, user) {
  return {
    id: user.id,
    email: user.email,
    firstName: normalizeText(user.firstName),
    lastName: normalizeText(user.lastName),
    name: normalizeText(user.name),
    phone: user.phone || '',
    role: user.role,
    managerId: user.managerId || '',
    hourlyRateCzk: String(user.hourlyRateCzk ?? '0'),
    profile: normalizeProfile(user.profile),
    deletedAt: toIsoString(user.deletedAt),
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}
