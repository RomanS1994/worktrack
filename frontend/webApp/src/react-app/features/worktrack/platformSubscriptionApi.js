import { baseApi } from '@shared/app/api/baseApi.js';

const platformSubscriptionApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getPlatformSubscriptionPayments: builder.query({
      query: () => '/platform/subscription-payments',
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
  useConfirmPlatformSubscriptionPaymentMutation,
  useRejectPlatformSubscriptionPaymentMutation,
} = platformSubscriptionApi;
