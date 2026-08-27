import { baseApi } from '@shared/app/api/baseApi.js';

export const managerTimesheetApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getManagerTimesheet: builder.query({
      query: month => ({ url: '/manager/timesheet', params: { month } }),
      providesTags: [{ type: 'WorkEntries', id: 'MANAGER_TIMESHEET' }],
    }),
    saveManagerTimesheetCell: builder.mutation({
      query: ({ employeeId, ...body }) => ({
        url: `/manager/timesheet/${employeeId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [{ type: 'WorkEntries', id: 'MANAGER_TIMESHEET' }],
    }),
  }),
});

export const { useGetManagerTimesheetQuery, useSaveManagerTimesheetCellMutation } = managerTimesheetApi;
