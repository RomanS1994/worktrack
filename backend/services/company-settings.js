import { createAuditLog } from '../db/prisma-helpers.js';
import { normalizeText, nowIso } from '../validation/common.js';

function requireManager(context) {
  const membership = context?.activeMembership || context?.membership || context || null;
  if (!membership?.companyId || membership.status === 'INACTIVE' || membership.role !== 'MANAGER') {
    throw new Error('Manager access is required');
  }
  return membership;
}

function serializeCompany(company) {
  if (!company) return null;
  return {
    id: company.id,
    name: normalizeText(company.name),
    slug: normalizeText(company.slug),
  };
}

export async function getCompanySettings(client, context) {
  const membership = requireManager(context);
  const company = await client.company.findUnique({ where: { id: membership.companyId } });
  if (!company) throw new Error('Company not found');
  return { company: serializeCompany(company) };
}

export async function updateCompanySettings(client, context, payload = {}) {
  const membership = requireManager(context);
  const name = normalizeText(payload.name);
  if (!name) throw new Error('Company name is required');

  const company = await client.company.update({
    where: { id: membership.companyId },
    data: {
      name,
      updatedAt: new Date(nowIso()),
    },
  });

  await createAuditLog(client, {
    action: 'company.updated',
    actorUserId: membership.userId,
    entityType: 'company',
    entityId: company.id,
    after: serializeCompany(company),
  });

  return { company: serializeCompany(company) };
}
