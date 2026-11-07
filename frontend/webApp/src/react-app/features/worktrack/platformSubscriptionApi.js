import { baseApi } from '@shared/app/api/baseApi.js';

const platformSubscriptionApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getPlatformSubscriptionPayments: builder.query({
      query: () => '/platform/subscription-payments',
    }),
    getPlatformAdminOverview: builder.query({
      query: () => '/platform/admin/overview',
    }),
    getPlatformAdminCompanies: builder.query({
      query: ({ search = '' } = {}) => `/platform/admin/companies${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`,
    }),
    confirmPlatformSubscriptionPayment: builder.mutation({
      query: paymentId => ({ url: `/platform/subscription-payments/${paymentId}/confirm`, method: 'POST' }),
    }),
    rejectPlatformSubscriptionPayment: builder.mutation({
      query: paymentId => ({ url: `/platform/subscription-payments/${paymentId}/reject`, method: 'POST' }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPlatformSubscriptionPaymentsQuery,
  useGetPlatformAdminOverviewQuery,
  useGetPlatformAdminCompaniesQuery,
  useConfirmPlatformSubscriptionPaymentMutation,
  useRejectPlatformSubscriptionPaymentMutation,
} = platformSubscriptionApi;
