import { baseApi } from '../../app/api/baseApi.js';

export const chatApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getChatSummary: builder.query({
      query: () => '/chat/summary',
      providesTags: [{ type: 'Notifications', id: 'CHAT_SUMMARY' }],
    }),
    getChatPresence: builder.query({
      query: () => '/chat/presence',
      providesTags: [{ type: 'Notifications', id: 'CHAT_PRESENCE' }],
    }),
    getChatReadStates: builder.query({
      query: () => '/chat/read-states',
      providesTags: [{ type: 'Notifications', id: 'CHAT_READ_STATES' }],
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
    sendChatTyping: builder.mutation({
      query: body => ({ url: '/chat/typing', method: 'POST', body }),
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
  useGetChatPresenceQuery,
  useGetChatReadStatesQuery,
  useGetChatMessagesQuery,
  useLazyGetChatMessagesQuery,
  useSendChatMessageMutation,
  useSendChatTypingMutation,
  useMarkChatReadMutation,
  useDeleteChatMessageMutation,
} = chatApi;
