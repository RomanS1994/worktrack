import { requireEmployee } from '../auth/context.js';
import { readJsonBody, sendPdf } from '../lib/http.js';
import { employeeFinancePdfFileName, generateEmployeeFinancePdfBuffer } from '../services/employee-finance-pdf.js';

export async function handleEmployeeFinancePdfRoutes(request, response, { pathName }) {
  if (request.method !== 'POST' || pathName !== '/api/employee-finance/pdf') return false;

  const context = await requireEmployee(request, response);
  if (!context) return true;

  const body = await readJsonBody(request);
  const report = {
    ...body,
    companyName: context.activeCompany?.name || body?.companyName || 'WorkTrack',
  };
  const buffer = await generateEmployeeFinancePdfBuffer(report);
  sendPdf(response, 200, buffer, employeeFinancePdfFileName(report));
  return true;
}
