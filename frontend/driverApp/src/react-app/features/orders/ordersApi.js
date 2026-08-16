import { baseApi } from '@shared/app/api/baseApi.js';

export const ordersApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getOrders: builder.query({
      query: (query = {}) => ({
        url: '/orders',
        params: {
          page: 1,
          limit: 50,
          ...query,
        },
      }),
      providesTags: result => {
        const orders = Array.isArray(result?.orders) ? result.orders : [];

        return [
          { type: 'Orders', id: 'LIST' },
          ...orders.map(order => ({ type: 'Orders', id: order.id })),
        ];
      },
    }),
    getOrder: builder.query({
      query: orderId => `/orders/${orderId}`,
      providesTags: (_result, _error, orderId) => [
        { type: 'Orders', id: orderId },
      ],
    }),
    getAvailableOrders: builder.query({
      query: () => '/orders/available',
      providesTags: result => {
        const offers = Array.isArray(result?.offers) ? result.offers : [];

        return [
          { type: 'AvailableOrders', id: 'LIST' },
          ...offers.map(offer => ({ type: 'AvailableOrders', id: offer.id })),
        ];
      },
    }),
    searchDispatchDrivers: builder.query({
      query: (query = {}) => ({
        url: '/orders/drivers',
        params: query,
      }),
      providesTags: [{ type: 'AvailableOrders', id: 'DRIVERS' }],
    }),
    createOrder: builder.mutation({
      query: body => ({
        url: '/orders',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Orders', id: 'LIST' },
        { type: 'Usage', id: 'CURRENT' },
      ],
    }),
    updateOrder: builder.mutation({
      query: ({ orderId, payload, options }) => ({
        url: `/orders/${orderId}`,
        method: 'PATCH',
        body: payload,
        ...(options || {}),
      }),
      invalidatesTags: (_result, _error, { orderId, skipInvalidation }) =>
        skipInvalidation
          ? []
          : [
              { type: 'Orders', id: 'LIST' },
              { type: 'Orders', id: orderId },
            ],
    }),
    deleteOrder: builder.mutation({
      query: orderId => ({
        url: `/orders/${orderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, orderId) => [
        { type: 'Orders', id: 'LIST' },
        { type: 'Orders', id: orderId },
        { type: 'Usage', id: 'CURRENT' },
      ],
    }),
    createOrderOffer: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/orders/${orderId}/offers`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'Orders', id: 'LIST' },
        { type: 'Orders', id: orderId },
        { type: 'AvailableOrders', id: 'LIST' },
      ],
    }),
    acceptOrderOffer: builder.mutation({
      query: ({ orderId, offerId }) => ({
        url: `/orders/${orderId}/offers/${offerId}/accept`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { orderId, offerId }) => [
        { type: 'Orders', id: 'LIST' },
        { type: 'Orders', id: orderId },
        { type: 'AvailableOrders', id: 'LIST' },
        { type: 'AvailableOrders', id: offerId },
      ],
    }),
    skipOrderOffer: builder.mutation({
      query: ({ orderId, offerId }) => ({
        url: `/orders/${orderId}/offers/${offerId}/skip`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { offerId }) => [
        { type: 'AvailableOrders', id: 'LIST' },
        { type: 'AvailableOrders', id: offerId },
      ],
    }),
    assignDriver: builder.mutation({
      query: ({ orderId, userId }) => ({
        url: `/orders/${orderId}/assign-driver`,
        method: 'PATCH',
        body: {
          userId,
        },
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'Orders', id: 'LIST' },
        { type: 'Orders', id: orderId },
      ],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderQuery,
  useGetAvailableOrdersQuery,
  useSearchDispatchDriversQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  useCreateOrderOfferMutation,
  useAcceptOrderOfferMutation,
  useSkipOrderOfferMutation,
  useAssignDriverMutation,
} = ordersApi;
