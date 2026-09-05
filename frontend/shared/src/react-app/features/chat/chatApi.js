import { baseApi } from '../../app/api/baseApi.js';

export const chatApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getChatSummary: builder.query({
      query: () => '/chat/summary',
      providesTags: [{ type: 'Notifications', id: 'CHAT_SUMMARY' }],
    }),
    getChatMessages: builder.query({
      query: ({ before = '', limit = 50 } = {}) => ({
        url: '/chat/messages',
        params: { ...(before ? { before } : {}), limit },
      }),
      providesTags: [{ type: 'Notifications', id: 'CHAT_MESSAGES' }],
    }),
    sendChatMessage: builder.mutation({
      query: body => ({ url: '/chat/messages', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Notifications', id: 'CHAT_MESSAGES' },
        { type: 'Notifications', id: 'CHAT_SUMMARY' },
      ],
    }),
    markChatRead: builder.mutation({
      query: body => ({ url: '/chat/read', method: 'POST', body }),
      invalidatesTags: [{ type: 'Notifications', id: 'CHAT_SUMMARY' }],
    }),
    deleteChatMessage: builder.mutation({
      query: messageId => ({ url: `/chat/messages/${messageId}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Notifications', id: 'CHAT_MESSAGES' },
        { type: 'Notifications', id: 'CHAT_SUMMARY' },
      ],
    }),
  }),
});

export const {
  useGetChatSummaryQuery,
  useGetChatMessagesQuery,
  useLazyGetChatMessagesQuery,
  useSendChatMessageMutation,
  useMarkChatReadMutation,
  useDeleteChatMessageMutation,
} = chatApi;
