import { baseApi } from '../../app/api/baseApi.js';

function buildAdminPath(path) {
  return `/manager${path}`;
}

export const adminApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getAdminUsers: builder.query({
      query: (query = {}) => ({
        url: buildAdminPath('/users'),
        params: query,
      }),
      providesTags: result => {
        const users = Array.isArray(result?.users) ? result.users : [];

        return [
          { type: 'AdminUsers', id: 'LIST' },
          ...users.map(user => ({ type: 'AdminUsers', id: user.id })),
        ];
      },
    }),
    getAdminUser: builder.query({
      query: userId => buildAdminPath(`/users/${userId}`),
      providesTags: (_result, _error, userId) => [
        { type: 'AdminUsers', id: userId },
      ],
    }),
    updateUserRole: builder.mutation({
      query: ({ userId, role }) => ({
        url: buildAdminPath(`/users/${userId}/role`),
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'AdminUsers', id: 'LIST' },
        { type: 'AdminUsers', id: userId },
        { type: 'AuditLogs', id: 'LIST' },
      ],
    }),
    updateUserSubscription: builder.mutation({
      query: ({ userId, payload }) => ({
        url: buildAdminPath(`/users/${userId}/subscription`),
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'AdminUsers', id: 'LIST' },
        { type: 'AdminUsers', id: userId },
        { type: 'Usage', id: 'CURRENT' },
        { type: 'Me', id: 'CURRENT' },
        { type: 'AuditLogs', id: 'LIST' },
      ],
    }),
    extendUserSubscription: builder.mutation({
      query: ({ userId, months }) => ({
        url: buildAdminPath(`/users/${userId}/subscription/extend`),
        method: 'POST',
        body: { months },
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'AdminUsers', id: 'LIST' },
        { type: 'AdminUsers', id: userId },
        { type: 'Usage', id: 'CURRENT' },
        { type: 'Me', id: 'CURRENT' },
        { type: 'AuditLogs', id: 'LIST' },
      ],
    }),
    confirmUserSubscriptionPayment: builder.mutation({
      query: ({ userId, payload }) => ({
        url: buildAdminPath(`/users/${userId}/subscription/confirm-payment`),
        method: 'POST',
        body: payload || {},
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'AdminUsers', id: 'LIST' },
        { type: 'AdminUsers', id: userId },
        { type: 'Usage', id: 'CURRENT' },
        { type: 'Me', id: 'CURRENT' },
        { type: 'AuditLogs', id: 'LIST' },
      ],
    }),
    getAdminPlans: builder.query({
      query: () => buildAdminPath('/plans'),
      providesTags: result => {
        const plans = Array.isArray(result?.plans) ? result.plans : [];

        return [
          { type: 'AdminPlans', id: 'LIST' },
          ...plans.map(plan => ({ type: 'AdminPlans', id: plan.id })),
        ];
      },
    }),
    createPlan: builder.mutation({
      query: payload => ({
        url: buildAdminPath('/plans'),
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [
        { type: 'AdminPlans', id: 'LIST' },
        { type: 'AuditLogs', id: 'LIST' },
      ],
    }),
    updatePlan: builder.mutation({
      query: ({ planId, payload }) => ({
        url: buildAdminPath(`/plans/${planId}`),
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: (_result, _error, { planId }) => [
        { type: 'AdminPlans', id: 'LIST' },
        { type: 'AdminPlans', id: planId },
        { type: 'AuditLogs', id: 'LIST' },
      ],
    }),
    getAdminOrders: builder.query({
      query: (query = {}) => ({
        url: buildAdminPath('/orders'),
        params: query,
      }),
      providesTags: result => {
        const orders = Array.isArray(result?.orders) ? result.orders : [];

        return [
          { type: 'AdminOrders', id: 'LIST' },
          ...orders.map(order => ({ type: 'AdminOrders', id: order.id })),
        ];
      },
    }),
    getAdminOrder: builder.query({
      query: queryArg => {
        if (typeof queryArg === 'string') {
          return buildAdminPath(`/orders/${queryArg}`);
        }

        const orderId = queryArg?.orderId || '';
        const state = queryArg?.state || '';

        return {
          url: buildAdminPath(`/orders/${orderId}`),
          params: state ? { state } : undefined,
        };
      },
      providesTags: (_result, _error, queryArg) => [
        { type: 'AdminOrders', id: typeof queryArg === 'string' ? queryArg : queryArg?.orderId },
      ],
    }),
    restoreOrder: builder.mutation({
      query: ({ orderId }) => ({
        url: buildAdminPath(`/orders/${orderId}/restore`),
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'AdminOrders', id: 'LIST' },
        { type: 'AdminOrders', id: orderId },
      ],
    }),
    getAuditLogs: builder.query({
      query: (query = {}) => ({
        url: buildAdminPath('/audit'),
        params: query,
      }),
      providesTags: result => {
        const audit = Array.isArray(result?.audit) ? result.audit : [];

        return [
          { type: 'AuditLogs', id: 'LIST' },
          ...audit.map(entry => ({ type: 'AuditLogs', id: entry.id })),
        ];
      },
    }),
  }),
});

export const {
  useGetAdminUsersQuery,
  useGetAdminUserQuery,
  useUpdateUserRoleMutation,
  useUpdateUserSubscriptionMutation,
  useExtendUserSubscriptionMutation,
  useConfirmUserSubscriptionPaymentMutation,
  useGetAdminPlansQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useGetAdminOrdersQuery,
  useGetAdminOrderQuery,
  useRestoreOrderMutation,
  useGetAuditLogsQuery,
} = adminApi;
