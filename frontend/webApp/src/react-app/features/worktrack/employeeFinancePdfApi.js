import { baseApi } from '@shared/app/api/baseApi.js';

export const employeeFinancePdfApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    downloadEmployeeFinancePdf: builder.mutation({
      query: body => ({
        url: '/employee-finance/pdf',
        method: 'POST',
        body,
        responseHandler: response => response.blob(),
      }),
    }),
  }),
});

export const { useDownloadEmployeeFinancePdfMutation } = employeeFinancePdfApi;
