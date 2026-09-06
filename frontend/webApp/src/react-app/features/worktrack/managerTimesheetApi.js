import { baseApi } from '@shared/app/api/baseApi.js';
import { MANAGER_TIMESHEET_TAG } from './cacheTags.js';

export const managerTimesheetApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getManagerTimesheet: builder.query({
      query: month => ({ url: '/manager/timesheet', params: { month } }),
      providesTags: [MANAGER_TIMESHEET_TAG],
    }),
    saveManagerTimesheetCell: builder.mutation({
      query: ({ employeeId, ...body }) => ({
        url: `/manager/timesheet/${employeeId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        MANAGER_TIMESHEET_TAG,
        { type: 'WeeklySubmissions' },
      ],
    }),
  }),
});

export const { useGetManagerTimesheetQuery, useSaveManagerTimesheetCellMutation } = managerTimesheetApi;
