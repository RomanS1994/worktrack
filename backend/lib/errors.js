import { sendError } from './http.js';

const STATUS_BY_MESSAGE = new Map([
  ['User with this email already exists', 409],
  ['User not found', 404],
  ['Route not found', 404],
  ['Too many failed login attempts. Try again later.', 429],
  ['Too many failed registration attempts. Try again later.', 429],
  ['Invalid JSON body', 400],
  ['Request body is too large', 400],
  ['Invalid role', 400],
  ['Name is required', 400],
  ['First name is required', 400],
  ['Last name is required', 400],
  ['Company name is required', 400],
  ['Company not found', 404],
  ['Company access is required', 403],
  ['Business identifiers are already used', 409],
  ['Name is required for a new manager', 400],
  ['Email is required', 400],
  ['Email and password are required', 400],
  ['Password is required for a new manager', 400],
  ['Password must be at least 8 characters long', 400],
  ['Current password is required', 400],
  ['Current password is incorrect', 400],
  ['New password must be at least 8 characters long', 400],
  ['New password must be different', 400],
  ['Invalid phone number', 400],
  ['Phone number is already used', 409],
  ['Employee access is required', 403],
  ['Manager access is required', 403],
  ['Project is required', 400],
  ['Project name is required', 400],
  ['Project not found', 404],
  ['Invalid hourly rate', 400],
  ['Invalid membership status', 400],
  ['Employee already belongs to this company', 409],
  ['User already belongs to this company', 409],
  ['Employee not found', 404],
  ['Invalid work date', 400],
  ['Invalid week start', 400],
  ['Invalid hours value', 400],
  ['Invalid weekly submission status', 400],
  ['Work entry already exists', 409],
  ['Work entry not found', 404],
  ['Work entry is locked', 409],
  ['Weekly submission not found', 404],
  ['Weekly submission is locked', 409],
  ['Weekly submission is already submitted', 409],
  ['Weekly submission is already approved', 409],
  ['Weekly submission is not pending review', 409],
  ['Employee is not assigned to a manager', 409],
  ['No work entries to submit', 400],
  ['Notification not found', 404],
  ['Invalid payroll anchor date', 400],
  ['Invalid payroll period', 400],
  ['Rejection reason is required', 400],
  ['Rejection reason must be 500 characters or fewer', 400],
  ['Invalid invoice month', 400],
  ['Complete tax information before creating an invoice', 400],
  ['Employer billing information is incomplete', 400],
  ['Invoice context not found', 404],
  ['Invoice not found', 404],
  ['No uninvoiced approved hours for this month', 400],
  ['Only draft invoices can be sent', 409],
  ['Invoice cannot be marked paid', 409],
]);

export function resolveErrorStatus(error) {
  const message = error instanceof Error ? error.message : String(error);
  return STATUS_BY_MESSAGE.get(message) || 500;
}

export function sendHttpError(response, error) {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  const status = resolveErrorStatus(error);

  if (status === 500) {
    console.error('Backend error:', error);
  }

  return sendError(response, status, message);
}
