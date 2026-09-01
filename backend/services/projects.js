import { randomUUID } from 'node:crypto';

import { createAuditLog } from '../db/prisma-helpers.js';
import { normalizeText, nowIso } from '../validation/common.js';

function activeMembership(context) {
  return context?.activeMembership || context?.membership || context || null;
}

function requireCompany(context) {
  const membership = activeMembership(context);
  if (!membership?.companyId || membership.status === 'INACTIVE') {
    throw new Error('Company access is required');
  }
  return membership;
}

function requireManager(context) {
  const membership = requireCompany(context);
  if (membership.role !== 'MANAGER') {
    throw new Error('Manager access is required');
  }
  return membership;
}

function iso(value) {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

export function serializeProject(project) {
  if (!project) return null;
  return {
    id: project.id,
    companyId: project.companyId,
    name: normalizeText(project.name),
    address: normalizeText(project.address),
    description: normalizeText(project.description),
    isActive: Boolean(project.isActive),
    createdAt: iso(project.createdAt),
    updatedAt: iso(project.updatedAt),
  };
}

async function findProject(client, companyId, projectId, { requireActive = true } = {}) {
  const id = normalizeText(projectId);
  if (!id) throw new Error('Project is required');

  const project = await client.project.findFirst({
    where: {
      id,
      companyId,
      ...(requireActive ? { isActive: true } : {}),
    },
  });

  if (!project) throw new Error('Project not found');
  return project;
}

function normalizeProjectInput(payload = {}) {
  const name = normalizeText(payload.name);
  if (!name) throw new Error('Project name is required');

  return {
    name,
    address: normalizeText(payload.address) || null,
    description: normalizeText(payload.description) || null,
  };
}

export async function listProjects(client, context) {
  const membership = requireCompany(context);
  const projects = await client.project.findMany({
    where: {
      companyId: membership.companyId,
      ...(membership.role === 'EMPLOYEE' ? { isActive: true } : {}),
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  return { projects: projects.map(serializeProject) };
}

export async function createProject(client, context, payload = {}) {
  const membership = requireManager(context);
  const timestamp = new Date(nowIso());
  const project = await client.project.create({
    data: {
      id: randomUUID(),
      companyId: membership.companyId,
      ...normalizeProjectInput(payload),
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });

  await createAuditLog(client, {
    action: 'project.created',
    actorUserId: membership.userId,
    entityType: 'project',
    entityId: project.id,
    after: serializeProject(project),
  });

  return serializeProject(project);
}

export async function updateProject(client, context, projectId, payload = {}) {
  const membership = requireManager(context);
  const existing = await findProject(client, membership.companyId, projectId, { requireActive: false });
  const data = {
    ...normalizeProjectInput({ ...existing, ...payload }),
    updatedAt: new Date(nowIso()),
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    data.isActive = Boolean(payload.isActive);
  }

  const project = await client.project.update({ where: { id: existing.id }, data });

  await createAuditLog(client, {
    action: 'project.updated',
    actorUserId: membership.userId,
    entityType: 'project',
    entityId: project.id,
    before: serializeProject(existing),
    after: serializeProject(project),
  });

  return serializeProject(project);
}

export async function deactivateProject(client, context, projectId) {
  return updateProject(client, context, projectId, { isActive: false });
}
