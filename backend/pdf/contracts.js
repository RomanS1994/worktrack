import { DEFAULT_PLAN_ID, getPdfDocumentType, getPlanById } from '../config/plans.js';
import { renderPdfFromHtml } from './renderer.js';
import { renderContractPdfHtml } from './templates.js';

function normalizeDocumentType(documentType) {
  const resolved = getPdfDocumentType(documentType);

  if (!resolved) {
    throw new Error('Invalid PDF document type');
  }

  return resolved;
}

function normalizePlan(plan) {
  if (plan?.id) {
    return {
      ...(getPlanById(plan.id) || {}),
      ...plan,
    };
  }

  return getPlanById(DEFAULT_PLAN_ID);
}

function sanitizeFileNamePart(value) {
  return String(value || 'draft')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function buildContractPdfFileName({
  documentType = 'confirmation',
  orderNumber = 'draft',
} = {}) {
  const resolvedDocumentType = normalizeDocumentType(documentType);
  const safeOrderNumber = sanitizeFileNamePart(orderNumber) || 'draft';

  return `transfer-${resolvedDocumentType.fileNamePart}-${safeOrderNumber}.pdf`;
}

export async function createContractPdf({
  contractData = {},
  plan,
  documentType = 'confirmation',
  language = 'cs',
} = {}) {
  const resolvedPlan = normalizePlan(plan);
  const resolvedDocumentType = normalizeDocumentType(documentType);
  const html = renderContractPdfHtml({
    contractData,
    plan: resolvedPlan,
    documentType: resolvedDocumentType.id,
    language,
  });
  const buffer = await renderPdfFromHtml(html);

  return {
    buffer,
    fileName: buildContractPdfFileName({
      documentType: resolvedDocumentType.id,
      orderNumber: contractData?.orderNumber || 'draft',
    }),
  };
}
