import { baseApi } from '@shared/app/api/baseApi.js';

export const monthlyHoursApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getMonthlyHours: builder.query({
      query: month => ({ url: '/monthly-hours', params: { month } }),
      providesTags: [{ type: 'WorkEntries', id: 'MONTH' }],
    }),
  }),
});

export const { useGetMonthlyHoursQuery } = monthlyHoursApi;
