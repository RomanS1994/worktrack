import { baseApi } from '@shared/app/api/baseApi.js';

export const billingApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getTaxInformation: builder.query({ query: () => '/tax-information' }),
    updateTaxInformation: builder.mutation({ query: body => ({ url: '/tax-information', method: 'PATCH', body }) }),
    getCompanyBilling: builder.query({ query: () => '/company-billing' }),
    updateCompanyBilling: builder.mutation({ query: body => ({ url: '/company-billing', method: 'PATCH', body }) }),
    getInvoicePreview: builder.query({ query: month => `/invoices/preview?month=${encodeURIComponent(month)}` }),
    getInvoices: builder.query({ query: () => '/invoices', providesTags: ['Invoices'] }),
    createInvoice: builder.mutation({ query: body => ({ url: '/invoices', method: 'POST', body }), invalidatesTags: ['Invoices'] }),
    sendInvoice: builder.mutation({ query: invoiceId => ({ url: `/invoices/${invoiceId}/send`, method: 'POST' }), invalidatesTags: ['Invoices'] }),
    cancelInvoice: builder.mutation({ query: invoiceId => ({ url: `/invoices/${invoiceId}/cancel`, method: 'POST' }), invalidatesTags: ['Invoices'] }),
    getManagerInvoices: builder.query({ query: () => '/manager/invoices', providesTags: ['Invoices'] }),
    markInvoiceViewed: builder.mutation({ query: invoiceId => ({ url: `/manager/invoices/${invoiceId}/viewed`, method: 'POST' }), invalidatesTags: ['Invoices'] }),
    markInvoicePaid: builder.mutation({ query: invoiceId => ({ url: `/manager/invoices/${invoiceId}/paid`, method: 'POST' }), invalidatesTags: ['Invoices'] }),
  }),
});

export const {
  useGetTaxInformationQuery,
  useUpdateTaxInformationMutation,
  useGetCompanyBillingQuery,
  useUpdateCompanyBillingMutation,
  useLazyGetInvoicePreviewQuery,
  useGetInvoicesQuery,
  useCreateInvoiceMutation,
  useSendInvoiceMutation,
  useCancelInvoiceMutation,
  useGetManagerInvoicesQuery,
  useMarkInvoiceViewedMutation,
  useMarkInvoicePaidMutation,
} = billingApi;
