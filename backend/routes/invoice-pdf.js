import { requireEmployee, requireManager } from '../auth/context.js';
import { runStoreRead } from '../db/store.js';
import { sendPdf } from '../lib/http.js';
import { generateInvoicePdfBuffer, invoicePdfFileName } from '../services/invoice-pdf.js';
import { getEmployeeInvoice, getManagerInvoice } from '../services/invoices.js';

export async function handleInvoicePdfRoutes(request, response, { pathName }) {
  const employeeMatch = pathName.match(/^\/api\/invoices\/([^/]+)\/pdf$/);
  if (request.method === 'GET' && employeeMatch) {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    const invoice = await runStoreRead({ prisma: client => getEmployeeInvoice(client, context, employeeMatch[1]) });
    const buffer = await generateInvoicePdfBuffer(invoice);
    sendPdf(response, 200, buffer, invoicePdfFileName(invoice));
    return true;
  }

  const managerMatch = pathName.match(/^\/api\/manager\/invoices\/([^/]+)\/pdf$/);
  if (request.method === 'GET' && managerMatch) {
    const context = await requireManager(request, response);
    if (!context) return true;
    const invoice = await runStoreRead({ prisma: client => getManagerInvoice(client, context, managerMatch[1]) });
    const buffer = await generateInvoicePdfBuffer(invoice);
    sendPdf(response, 200, buffer, invoicePdfFileName(invoice));
    return true;
  }

  return false;
}
