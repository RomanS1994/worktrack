import { baseApi } from '../../app/api/baseApi.js';

function applyOptimisticReaction(draft, { messageId, emoji }) {
  const message = draft?.messages?.find(item => item.id === messageId);
  if (!message) return;

  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const currentMine = reactions.find(item => item.mine);

  if (currentMine?.emoji === emoji) {
    currentMine.count = Math.max(0, Number(currentMine.count || 0) - 1);
    currentMine.mine = false;
    if (currentMine.count <= 0) {
      message.reactions = reactions.filter(item => item !== currentMine);
    }
    return;
  }

  if (currentMine) {
    currentMine.count = Math.max(0, Number(currentMine.count || 0) - 1);
    currentMine.mine = false;
  }

  let next = reactions.find(item => item.emoji === emoji);
  if (!next) {
    next = { emoji, count: 0, mine: false, names: [] };
    reactions.push(next);
  }
  next.count = Number(next.count || 0) + 1;
  next.mine = true;
  message.reactions = reactions.filter(item => Number(item.count || 0) > 0);
}

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
    getChatReactions: builder.query({
      query: messageIds => ({
        url: '/chat/reactions',
        params: { messageIds },
      }),
      providesTags: [{ type: 'Notifications', id: 'CHAT_REACTIONS' }],
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
    toggleChatReaction: builder.mutation({
      query: body => ({ url: '/chat/reactions', method: 'POST', body }),
      async onQueryStarted(body, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          chatApi.util.updateQueryData('getChatMessages', { limit: 50 }, draft => {
            applyOptimisticReaction(draft, body);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: 'Notifications', id: 'CHAT_MESSAGES' }],
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
  useGetChatReactionsQuery,
  useGetChatMessagesQuery,
  useLazyGetChatMessagesQuery,
  useSendChatMessageMutation,
  useToggleChatReactionMutation,
  useSendChatTypingMutation,
  useMarkChatReadMutation,
  useDeleteChatMessageMutation,
} = chatApi;
