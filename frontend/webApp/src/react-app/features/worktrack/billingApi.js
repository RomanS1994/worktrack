import { baseApi } from '@shared/app/api/baseApi.js';

export const billingApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getTaxInformation: builder.query({ query: () => '/tax-information' }),
    updateTaxInformation: builder.mutation({ query: body => ({ url: '/tax-information', method: 'PATCH', body }), invalidatesTags: ['InvoicePreview'] }),
    getCompanyBilling: builder.query({ query: () => '/company-billing' }),
    updateCompanyBilling: builder.mutation({ query: body => ({ url: '/company-billing', method: 'PATCH', body }), invalidatesTags: ['InvoicePreview'] }),
    getInvoicePreview: builder.query({ query: month => `/invoices/preview?month=${encodeURIComponent(month)}`, providesTags: ['InvoicePreview'] }),
    getInvoices: builder.query({ query: () => '/invoices', providesTags: ['Invoices'] }),
    getInvoice: builder.query({ query: invoiceId => `/invoices/${invoiceId}`, providesTags: ['Invoices'] }),
    getInvoiceHistory: builder.query({ query: invoiceId => `/invoices/${invoiceId}/history`, providesTags: ['Invoices'] }),
    getInvoicePdf: builder.mutation({
      query: ({ invoiceId, managerMode = false }) => ({
        url: `${managerMode ? '/manager' : ''}/invoices/${invoiceId}/pdf`,
        method: 'GET',
        responseHandler: response => response.blob(),
      }),
    }),
    createInvoice: builder.mutation({ query: body => ({ url: '/invoices', method: 'POST', body }), invalidatesTags: ['Invoices', 'InvoicePreview'] }),
    sendInvoice: builder.mutation({ query: invoiceId => ({ url: `/invoices/${invoiceId}/send`, method: 'POST' }), invalidatesTags: ['Invoices'] }),
    deleteInvoice: builder.mutation({ query: invoiceId => ({ url: `/invoices/${invoiceId}`, method: 'DELETE' }), invalidatesTags: ['Invoices', 'InvoicePreview'] }),
    cancelInvoice: builder.mutation({ query: invoiceId => ({ url: `/invoices/${invoiceId}/cancel`, method: 'POST' }), invalidatesTags: ['Invoices', 'InvoicePreview'] }),
    getManagerInvoices: builder.query({ query: () => '/manager/invoices', providesTags: ['Invoices'] }),
    getManagerInvoice: builder.query({ query: invoiceId => `/manager/invoices/${invoiceId}`, providesTags: ['Invoices'] }),
    getManagerInvoiceHistory: builder.query({ query: invoiceId => `/manager/invoices/${invoiceId}/history`, providesTags: ['Invoices'] }),
    markInvoiceViewed: builder.mutation({ query: invoiceId => ({ url: `/manager/invoices/${invoiceId}/viewed`, method: 'POST' }), invalidatesTags: ['Invoices'] }),
    markInvoicePaid: builder.mutation({ query: ({ invoiceId, paidDate }) => ({ url: `/manager/invoices/${invoiceId}/paid`, method: 'POST', body: { paidDate } }), invalidatesTags: ['Invoices'] }),
  }),
});

export const {
  useGetTaxInformationQuery,
  useUpdateTaxInformationMutation,
  useGetCompanyBillingQuery,
  useUpdateCompanyBillingMutation,
  useLazyGetInvoicePreviewQuery,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useGetInvoiceHistoryQuery,
  useGetInvoicePdfMutation,
  useCreateInvoiceMutation,
  useSendInvoiceMutation,
  useDeleteInvoiceMutation,
  useCancelInvoiceMutation,
  useGetManagerInvoicesQuery,
  useGetManagerInvoiceQuery,
  useGetManagerInvoiceHistoryQuery,
  useMarkInvoiceViewedMutation,
  useMarkInvoicePaidMutation,
} = billingApi;
