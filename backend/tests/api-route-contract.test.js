import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';

import { routeRequest } from '../routes/index.js';

const FRONTEND_API_CONTRACTS = [
  ['POST', '/api/auth/register'],
  ['POST', '/api/auth/register-company'],
  ['POST', '/api/auth/login'],
  ['POST', '/api/auth/refresh'],
  ['POST', '/api/auth/logout'],
  ['GET', '/api/me'],
  ['PATCH', '/api/me/profile'],
  ['PATCH', '/api/me/password'],
  ['DELETE', '/api/me'],
  ['GET', '/api/notifications'],
  ['POST', '/api/notifications/notification-test/read'],
  ['POST', '/api/notifications/read-all'],
  ['GET', '/api/projects'],
  ['POST', '/api/projects'],
  ['PATCH', '/api/projects/project-test'],
  ['POST', '/api/projects/project-test/deactivate'],
  ['GET', '/api/company-settings'],
  ['PATCH', '/api/company-settings'],
  ['GET', '/api/tax-information'],
  ['PATCH', '/api/tax-information'],
  ['GET', '/api/company-billing'],
  ['PATCH', '/api/company-billing'],
  ['GET', '/api/monthly-hours?month=2026-08'],
  ['GET', '/api/invoices/preview?month=2026-08'],
  ['GET', '/api/invoices'],
  ['POST', '/api/invoices'],
  ['POST', '/api/invoices/invoice-test/send'],
  ['POST', '/api/invoices/invoice-test/cancel'],
  ['GET', '/api/manager/invoices'],
  ['POST', '/api/manager/invoices/invoice-test/viewed'],
  ['POST', '/api/manager/invoices/invoice-test/paid'],
  ['GET', '/api/work-entries?weekStart=2026-08-17'],
  ['POST', '/api/work-entries'],
  ['PATCH', '/api/work-entries/entry-test'],
  ['DELETE', '/api/work-entries/entry-test'],
  ['POST', '/api/weekly-submissions'],
  ['GET', '/api/work-summary?weekStart=2026-08-17'],
  ['GET', '/api/manager/payroll?period=week&anchor=2026-08-17'],
  ['GET', '/api/manager/employees'],
  ['POST', '/api/manager/employees'],
  ['PATCH', '/api/manager/employees/membership-test'],
  ['POST', '/api/manager/employees/membership-test/reset-password'],
  ['GET', '/api/manager/submissions?status=SUBMITTED'],
  ['GET', '/api/manager/submissions/submission-test'],
  ['POST', '/api/manager/submissions/submission-test/approve'],
  ['POST', '/api/manager/submissions/submission-test/reject'],
];

function createRequest(method, url) {
  const request = Readable.from([]);
  request.method = method;
  request.url = url;
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' };
  return request;
}

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    ended: false,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    writeHead(statusCode, nextHeaders = {}) {
      this.statusCode = statusCode;
      for (const [name, value] of Object.entries(nextHeaders)) {
        this.setHeader(name, value);
      }
      return this;
    },
    end(chunk = '') {
      this.body += chunk ? String(chunk) : '';
      this.ended = true;
    },
  };
}

for (const [method, url] of FRONTEND_API_CONTRACTS) {
  test(`${method} ${url} is recognized by the backend router`, async () => {
    const request = createRequest(method, url);
    const response = createResponse();

    try {
      await routeRequest(request, response);
    } catch (error) {
      assert.notEqual(
        error instanceof Error ? error.message : String(error),
        'Route not found',
        `${method} ${url} is used by the frontend but has no backend route`
      );
    }
  });
}
