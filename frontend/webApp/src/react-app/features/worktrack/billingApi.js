import { baseApi } from '@shared/app/api/baseApi.js';

export const billingApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getTaxInformation: builder.query({ query: () => '/tax-information' }),
    updateTaxInformation: builder.mutation({ query: body => ({ url: '/tax-information', method: 'PATCH', body }) }),
    getCompanyBilling: builder.query({ query: () => '/company-billing' }),
    updateCompanyBilling: builder.mutation({ query: body => ({ url: '/company-billing', method: 'PATCH', body }) }),
    getInvoices: builder.query({ query: () => '/invoices', providesTags: ['Invoices'] }),
    createInvoice: builder.mutation({ query: body => ({ url: '/invoices', method: 'POST', body }), invalidatesTags: ['Invoices'] }),
    sendInvoice: builder.mutation({ query: invoiceId => ({ url: `/invoices/${invoiceId}/send`, method: 'POST' }), invalidatesTags: ['Invoices'] }),
    getManagerInvoices: builder.query({ query: () => '/manager/invoices', providesTags: ['Invoices'] }),
    markInvoicePaid: builder.mutation({ query: invoiceId => ({ url: `/manager/invoices/${invoiceId}/paid`, method: 'POST' }), invalidatesTags: ['Invoices'] }),
  }),
});

export const { useGetTaxInformationQuery, useUpdateTaxInformationMutation, useGetCompanyBillingQuery, useUpdateCompanyBillingMutation, useGetInvoicesQuery, useCreateInvoiceMutation, useSendInvoiceMutation, useGetManagerInvoicesQuery, useMarkInvoicePaidMutation } = billingApi;
