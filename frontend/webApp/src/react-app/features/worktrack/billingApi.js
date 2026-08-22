import { baseApi } from '@shared/app/api/baseApi.js';

export const billingApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getTaxInformation: builder.query({
      query: () => '/tax-information',
    }),
    updateTaxInformation: builder.mutation({
      query: body => ({ url: '/tax-information', method: 'PATCH', body }),
    }),
    getInvoices: builder.query({
      query: () => '/invoices',
    }),
  }),
});

export const {
  useGetTaxInformationQuery,
  useUpdateTaxInformationMutation,
  useGetInvoicesQuery,
} = billingApi;
