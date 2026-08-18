import { baseApi } from '@shared/app/api/baseApi.js';

export const worktrackApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getWorkSummary: builder.query({
      query: (query = {}) => ({
        url: '/work-summary',
        params: query,
      }),
      providesTags: [{ type: 'WorkEntries', id: 'SUMMARY' }],
    }),
    getProjects: builder.query({
      query: () => '/projects',
      providesTags: result => {
        const projects = Array.isArray(result?.projects) ? result.projects : [];

        return [
          { type: 'Projects', id: 'LIST' },
          ...projects.map(project => ({ type: 'Projects', id: project.id })),
        ];
      },
    }),
    createProject: builder.mutation({
      query: body => ({
        url: '/projects',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Projects', id: 'LIST' },
        { type: 'WorkEntries', id: 'SUMMARY' },
      ],
    }),
    updateProject: builder.mutation({
      query: ({ projectId, ...body }) => ({
        url: `/projects/${projectId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'Projects', id: 'LIST' },
        { type: 'Projects', id: projectId },
        { type: 'WorkEntries', id: 'SUMMARY' },
      ],
    }),
    deactivateProject: builder.mutation({
      query: projectId => ({
        url: `/projects/${projectId}/deactivate`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, projectId) => [
        { type: 'Projects', id: 'LIST' },
        { type: 'Projects', id: projectId },
        { type: 'WorkEntries', id: 'SUMMARY' },
      ],
    }),
    getCompanySettings: builder.query({
      query: () => '/company-settings',
      providesTags: [{ type: 'Company', id: 'SETTINGS' }],
    }),
    updateCompanySettings: builder.mutation({
      query: body => ({
        url: '/company-settings',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [{ type: 'Company', id: 'SETTINGS' }],
    }),
    getWeekEntries: builder.query({
      query: (query = {}) => ({
        url: '/work-entries',
        params: query,
      }),
      providesTags: result => {
        const entries = Array.isArray(result?.entries) ? result.entries : [];

        return [
          { type: 'WorkEntries', id: 'WEEK' },
          ...entries.map(entry => ({ type: 'WorkEntries', id: entry.id })),
        ];
      },
    }),
    createWorkEntry: builder.mutation({
      query: payload => ({
        url: '/work-entries',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [
        { type: 'WorkEntries', id: 'WEEK' },
        { type: 'WorkEntries', id: 'SUMMARY' },
      ],
    }),
    updateWorkEntry: builder.mutation({
      query: ({ entryId, hours, projectId }) => ({
        url: `/work-entries/${entryId}`,
        method: 'PATCH',
        body: {
          hours,
          ...(projectId ? { projectId } : {}),
        },
      }),
      invalidatesTags: (_result, _error, { entryId }) => [
        { type: 'WorkEntries', id: 'WEEK' },
        { type: 'WorkEntries', id: 'SUMMARY' },
        { type: 'WorkEntries', id: entryId },
      ],
    }),
    deleteWorkEntry: builder.mutation({
      query: entryId => ({
        url: `/work-entries/${entryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, entryId) => [
        { type: 'WorkEntries', id: 'WEEK' },
        { type: 'WorkEntries', id: 'SUMMARY' },
        { type: 'WorkEntries', id: entryId },
      ],
    }),
    submitWeek: builder.mutation({
      query: payload => ({
        url: '/weekly-submissions',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [
        { type: 'WorkEntries', id: 'WEEK' },
        { type: 'WorkEntries', id: 'SUMMARY' },
        { type: 'WeeklySubmissions', id: 'LIST' },
      ],
    }),
    getManagerEmployees: builder.query({
      query: () => '/manager/employees',
      providesTags: result => {
        const employees = Array.isArray(result?.employees) ? result.employees : [];

        return [
          { type: 'Employees', id: 'LIST' },
          ...employees.map(employee => ({ type: 'Employees', id: employee.id })),
        ];
      },
    }),
    createManagerEmployee: builder.mutation({
      query: body => ({
        url: '/manager/employees',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Employees', id: 'LIST' },
        { type: 'WorkEntries', id: 'SUMMARY' },
      ],
    }),
    updateManagerEmployee: builder.mutation({
      query: ({ employeeId, ...body }) => ({
        url: `/manager/employees/${employeeId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { employeeId }) => [
        { type: 'Employees', id: 'LIST' },
        { type: 'Employees', id: employeeId },
        { type: 'WorkEntries', id: 'SUMMARY' },
      ],
    }),
    getManagerSubmissions: builder.query({
      query: (query = {}) => ({
        url: '/manager/submissions',
        params: query,
      }),
      providesTags: result => {
        const submissions = Array.isArray(result?.submissions)
          ? result.submissions
          : [];

        return [
          { type: 'WeeklySubmissions', id: 'LIST' },
          ...submissions.map(submission => ({
            type: 'WeeklySubmissions',
            id: submission.id,
          })),
        ];
      },
    }),
    getManagerSubmission: builder.query({
      query: submissionId => `/manager/submissions/${submissionId}`,
      providesTags: (_result, _error, submissionId) => [
        { type: 'WeeklySubmissions', id: submissionId },
      ],
    }),
    approveSubmission: builder.mutation({
      query: submissionId => ({
        url: `/manager/submissions/${submissionId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, submissionId) => [
        { type: 'WeeklySubmissions', id: 'LIST' },
        { type: 'WeeklySubmissions', id: submissionId },
        { type: 'WorkEntries', id: 'SUMMARY' },
        { type: 'Employees', id: 'LIST' },
      ],
    }),
    rejectSubmission: builder.mutation({
      query: ({ submissionId, rejectionReason }) => ({
        url: `/manager/submissions/${submissionId}/reject`,
        method: 'POST',
        body: { rejectionReason },
      }),
      invalidatesTags: (_result, _error, { submissionId }) => [
        { type: 'WeeklySubmissions', id: 'LIST' },
        { type: 'WeeklySubmissions', id: submissionId },
        { type: 'WorkEntries', id: 'SUMMARY' },
        { type: 'Employees', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetWorkSummaryQuery,
  useGetProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeactivateProjectMutation,
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
  useGetWeekEntriesQuery,
  useCreateWorkEntryMutation,
  useUpdateWorkEntryMutation,
  useDeleteWorkEntryMutation,
  useSubmitWeekMutation,
  useGetManagerEmployeesQuery,
  useCreateManagerEmployeeMutation,
  useUpdateManagerEmployeeMutation,
  useGetManagerSubmissionsQuery,
  useGetManagerSubmissionQuery,
  useApproveSubmissionMutation,
  useRejectSubmissionMutation,
} = worktrackApi;
