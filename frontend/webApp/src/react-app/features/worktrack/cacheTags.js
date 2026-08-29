export const WORK_TOTAL_TAGS = [
  { type: 'WorkEntries', id: 'SUMMARY' },
  { type: 'WorkEntries', id: 'PAYROLL' },
];

export const WORK_ENTRY_TAGS = [
  { type: 'WorkEntries', id: 'WEEK' },
  ...WORK_TOTAL_TAGS,
];

export const INVOICE_AFFECTING_TAGS = [
  ...WORK_ENTRY_TAGS,
  'InvoicePreview',
];

export const MANAGER_REVIEW_TAGS = [
  { type: 'WeeklySubmissions', id: 'LIST' },
  ...WORK_TOTAL_TAGS,
  { type: 'Employees', id: 'LIST' },
  'InvoicePreview',
];

export function withWorkEntry(entryId) {
  return entryId ? [...INVOICE_AFFECTING_TAGS, { type: 'WorkEntries', id: entryId }] : INVOICE_AFFECTING_TAGS;
}

export function withSubmission(submissionId, { notifications = false } = {}) {
  return [
    ...MANAGER_REVIEW_TAGS,
    ...(submissionId ? [{ type: 'WeeklySubmissions', id: submissionId }] : []),
    ...(notifications ? [{ type: 'Notifications', id: 'LIST' }] : []),
  ];
}
