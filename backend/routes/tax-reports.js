import { getAuthContext } from '../auth/context.js';
import { prisma } from '../db/prisma.js';
import { readJsonBody, sendBuffer, sendError } from '../lib/http.js';
import {
  buildTaxMonthReport,
  createTaxAccountantPdf,
  createTaxDriverPdf,
  createTaxExcelReport,
  getTaxReportContentType,
} from '../services/tax-reports.js';
import { normalizeText } from '../validation/common.js';

const SUPPORTED_REPORT_TYPES = new Set(['pdf', 'excel', 'accountant']);

function normalizeReportType(value) {
  const type = normalizeText(value).toLowerCase();

  return SUPPORTED_REPORT_TYPES.has(type) ? type : '';
}

async function buildReportFile(type, report) {
  if (type === 'pdf') {
    return createTaxDriverPdf(report);
  }

  if (type === 'excel') {
    return createTaxExcelReport(report);
  }

  return createTaxAccountantPdf(report);
}

export async function handleTaxReportRoutes(request, response, { pathName }) {
  if (request.method !== 'POST' || pathName !== '/api/tax-reports/download') {
    return false;
  }

  const context = await getAuthContext(request, response);
  if (!context) return true;

  const body = await readJsonBody(request);
  const type = normalizeReportType(body.type);

  if (!type) {
    sendError(response, 400, 'Invalid tax report type');
    return true;
  }

  const report = await buildTaxMonthReport(prisma, {
    language: body.language,
    month: body.month,
    user: context.user,
  });
  const file = await buildReportFile(type, report);

  sendBuffer(response, 200, file.buffer, {
    contentType: getTaxReportContentType(type),
    fileName: file.fileName,
  });
  return true;
}
