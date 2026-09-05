import { normalizeText } from '../validation/common.js';
import {
  createEmployeeWorkEntry,
  deleteEmployeeWorkEntry,
  getEmployeeWeek,
  submitEmployeeWeek,
  updateEmployeeWorkEntry,
} from './employee-work.js';
import { getManagerDashboard } from './manager-dashboard.js';
import { getManagerEmployees } from './manager-employees.js';
import {
  createManagerEmployee,
  getManagerSubmissionById,
  listManagerSubmissions,
  reviewWeeklySubmission,
  updateEmployeeMembership,
  updateSubmittedWorkEntryByManager,
} from './manager-workflow.js';
import {
  createProject,
  deactivateProject,
  listProjects,
  serializeProject,
  updateProject,
} from './projects.js';
import {
  getCompanySettings,
  updateCompanySettings,
} from './company-settings.js';
import { getWeekRange, serializeWeek } from './week-utils.js';

export {
  createEmployeeWorkEntry,
  createManagerEmployee,
  createProject,
  deactivateProject,
  deleteEmployeeWorkEntry,
  getCompanySettings,
  getEmployeeWeek,
  getManagerSubmissionById,
  getWeekRange,
  listManagerSubmissions,
  listProjects,
  reviewWeeklySubmission,
  serializeProject,
  serializeWeek,
  submitEmployeeWeek,
  updateCompanySettings,
  updateEmployeeMembership,
  updateEmployeeWorkEntry,
  updateProject,
  updateSubmittedWorkEntryByManager,
};

// Legacy compatibility facade: historical callers of worktrack.js expect this
// helper to return employee-only rows. The manager API imports getManagerEmployees
// directly and exposes the new dual-capability roster including managers.
export async function listManagerEmployees(client, context, now) {
  const payload = await getManagerEmployees(client, context, now);
  return {
    ...payload,
    employees: payload.employees.filter(employee => employee.role === 'EMPLOYEE'),
  };
}

export const getManagerDashboardSummary = getManagerDashboard;

export async function getEmployeeDashboardSummary(client, context, weekStartInput) {
  const membership = context?.activeMembership || context?.membership || context || null;
  const weekData = await getEmployeeWeek(client, context, weekStartInput);
  return {
    role: 'EMPLOYEE',
    company: membership?.company || context?.activeCompany || null,
    week: weekData.week,
    submission: weekData.submission,
    summary: weekData.summary,
  };
}

export function isValidWorkEntryStatus(value) {
  return ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(normalizeText(value).toUpperCase());
}
