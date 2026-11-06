import { baseApi } from '../../app/api/baseApi.js';

function normalizeMembers(reaction) {
  return Array.isArray(reaction?.members) ? reaction.members : [];
}

function normalizeNames(reaction) {
  return Array.isArray(reaction?.names) ? reaction.names : [];
}

function removeMemberFromReaction(reaction, membershipId) {
  const members = normalizeMembers(reaction);
  const removed = members.find(member => member.membershipId === membershipId);
  reaction.members = members.filter(member => member.membershipId !== membershipId);
  if (removed?.name) {
    const stillUsed = reaction.members.some(member => member.name === removed.name);
    if (!stillUsed) reaction.names = normalizeNames(reaction).filter(name => name !== removed.name);
  }
  reaction.count = Math.max(0, Number(reaction.count || 0) - (removed ? 1 : 0));
}

function addMemberToReaction(reaction, member) {
  const members = normalizeMembers(reaction);
  if (!members.some(item => item.membershipId === member.membershipId)) {
    reaction.members = [...members, member];
    reaction.count = Number(reaction.count || 0) + 1;
  }
  if (member.name && !normalizeNames(reaction).includes(member.name)) {
    reaction.names = [...normalizeNames(reaction), member.name];
  }
}

export function applyReactionEvent(draft, payload, currentMembershipId = '') {
  const messageId = String(payload?.messageId || '');
  const emoji = String(payload?.emoji || '');
  const actorMembershipId = String(payload?.membershipId || '');
  if (!messageId || !emoji || !actorMembershipId || !Array.isArray(draft?.messages)) return;

  const message = draft.messages.find(item => item.id === messageId);
  if (!message) return;

  let reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const replacedEmoji = String(payload?.replacedEmoji || '');
  const member = {
    membershipId: actorMembershipId,
    name: payload?.member?.name || payload?.name || 'User',
    avatarDataUrl: payload?.member?.avatarDataUrl || payload?.avatarDataUrl || '',
    mine: actorMembershipId === currentMembershipId,
  };

  for (const reaction of reactions) {
    const hasActor = normalizeMembers(reaction).some(item => item.membershipId === actorMembershipId);
    if (!hasActor) continue;
    if (reaction.emoji === emoji && payload.active) continue;
    removeMemberFromReaction(reaction, actorMembershipId);
    reaction.mine = normalizeMembers(reaction).some(item => item.mine);
  }

  if (replacedEmoji) {
    const replaced = reactions.find(item => item.emoji === replacedEmoji);
    if (replaced && normalizeMembers(replaced).some(item => item.membershipId === actorMembershipId)) {
      removeMemberFromReaction(replaced, actorMembershipId);
      replaced.mine = normalizeMembers(replaced).some(item => item.mine);
    }
  }

  if (payload.active) {
    let target = reactions.find(item => item.emoji === emoji);
    if (!target) {
      target = { messageId, emoji, count: 0, mine: false, names: [], members: [] };
      reactions.push(target);
    }
    target.messageId ||= messageId;
    addMemberToReaction(target, member);
    target.mine = normalizeMembers(target).some(item => item.mine);
  }

  reactions = reactions.filter(item => Number(item.count || 0) > 0);
  message.reactions = reactions;
}

function applyOptimisticReaction(draft, { messageId, emoji, member }) {
  const message = draft?.messages?.find(item => item.id === messageId);
  if (!message) return;

  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const currentMine = reactions.find(item => item.mine);
  const optimisticMember = member?.membershipId ? { ...member, mine: true } : null;

  if (currentMine?.emoji === emoji) {
    currentMine.count = Math.max(0, Number(currentMine.count || 0) - 1);
    currentMine.mine = false;
    if (Array.isArray(currentMine.members)) {
      currentMine.members = currentMine.members.filter(item => !item.mine);
    }
    if (optimisticMember?.name) {
      currentMine.names = normalizeNames(currentMine).filter(name => name !== optimisticMember.name);
    }
    if (currentMine.count <= 0) {
      message.reactions = reactions.filter(item => item !== currentMine);
    }
    return;
  }

  if (currentMine) {
    currentMine.count = Math.max(0, Number(currentMine.count || 0) - 1);
    currentMine.mine = false;
    if (Array.isArray(currentMine.members)) {
      currentMine.members = currentMine.members.filter(item => !item.mine);
    }
    if (optimisticMember?.name) {
      currentMine.names = normalizeNames(currentMine).filter(name => name !== optimisticMember.name);
    }
  }

  let next = reactions.find(item => item.emoji === emoji);
  if (!next) {
    next = { messageId, emoji, count: 0, mine: false, names: [], members: [] };
    reactions.push(next);
  }
  next.messageId ||= messageId;
  next.count = Number(next.count || 0) + 1;
  next.mine = true;
  if (optimisticMember) {
    if (!normalizeMembers(next).some(item => item.membershipId === optimisticMember.membershipId)) {
      next.members = [...normalizeMembers(next), optimisticMember];
    }
    if (optimisticMember.name && !normalizeNames(next).includes(optimisticMember.name)) {
      next.names = [...normalizeNames(next), optimisticMember.name];
    }
  }
  message.reactions = reactions.filter(item => Number(item.count || 0) > 0);
}

function upsertServerMessage(draft, message) {
  if (!message?.id || !Array.isArray(draft?.messages)) return;
  const nextMessage = {
    ...message,
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
  };
  const index = draft.messages.findIndex(
    item => item.id === nextMessage.id
      || (nextMessage.clientMessageId && item.clientMessageId === nextMessage.clientMessageId),
  );
  if (index >= 0) {
    draft.messages[index] = nextMessage;
  } else {
    draft.messages.push(nextMessage);
  }
}

export const chatApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getChatSummary: builder.query({
      query: ({ roomId = '' } = {}) => ({ url: '/chat/summary', params: { roomId } }),
      providesTags: [{ type: 'Notifications', id: 'CHAT_SUMMARY' }],
    }),
    getChatPresence: builder.query({
      query: ({ roomId = '' } = {}) => ({ url: '/chat/presence', params: { roomId } }),
      providesTags: [{ type: 'Notifications', id: 'CHAT_PRESENCE' }],
    }),
    getChatReadStates: builder.query({
      query: ({ roomId = '' } = {}) => ({ url: '/chat/read-states', params: { roomId } }),
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
      query: ({ before = '', beforeId = '', limit = 50, roomId = '' } = {}) => ({
        url: '/chat/messages',
        params: {
          ...(beforeId ? { beforeId } : before ? { before } : {}),
          limit,
          roomId,
        },
      }),
      providesTags: [{ type: 'Notifications', id: 'CHAT_MESSAGES' }],
    }),
    getChatMessageContext: builder.query({
      query: ({ messageId, radius = 20, roomId = '' }) => ({
        url: `/chat/messages/${messageId}/context`,
        params: { radius, roomId },
      }),
    }),
    sendChatMessage: builder.mutation({
      query: body => ({ url: '/chat/messages', method: 'POST', body }),
      async onQueryStarted(body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (!data?.message) return;
          dispatch(
            chatApi.util.updateQueryData('getChatMessages', { roomId: body.roomId || '', limit: 50 }, draft => {
              upsertServerMessage(draft, data.message);
            }),
          );
        } catch {
          // ChatPage owns per-message pending/failed UI so concurrent sends do not overwrite the composer.
        }
      },
    }),
    uploadChatAttachment: builder.mutation({
      query: body => ({ url: '/chat/attachments', method: 'POST', body }),
    }),
    deleteChatAttachment: builder.mutation({
      query: attachmentId => ({ url: `/chat/attachments/${attachmentId}`, method: 'DELETE' }),
    }),
    toggleChatReaction: builder.mutation({
      query: body => ({ url: '/chat/reactions', method: 'POST', body }),
      async onQueryStarted(body, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          chatApi.util.updateQueryData('getChatMessages', { roomId: body.roomId || '', limit: 50 }, draft => {
            applyOptimisticReaction(draft, body);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    sendChatTyping: builder.mutation({
      query: body => ({ url: '/chat/typing', method: 'POST', body }),
    }),
    markChatRead: builder.mutation({
      query: body => ({ url: '/chat/read', method: 'POST', body }),
      invalidatesTags: [{ type: 'Notifications', id: 'CHAT_SUMMARY' }],
    }),
    deleteChatMessage: builder.mutation({
      query: ({ messageId, roomId = '' }) => ({ url: `/chat/messages/${messageId}`, method: 'DELETE', params: { roomId } }),
      async onQueryStarted({ messageId, roomId = '' }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          chatApi.util.updateQueryData('getChatMessages', { roomId, limit: 50 }, draft => {
            if (!Array.isArray(draft?.messages)) return;
            draft.messages = draft.messages.filter(item => item.id !== messageId);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    editChatMessage: builder.mutation({
      query: ({ messageId, roomId = '', body }) => ({ url: `/chat/messages/${messageId}`, method: 'PATCH', params: { roomId }, body: { body } }),
      async onQueryStarted({ messageId, roomId = '' }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (!data?.message) return;
          dispatch(chatApi.util.updateQueryData('getChatMessages', { roomId, limit: 50 }, draft => {
            const index = draft?.messages?.findIndex(item => item.id === messageId) ?? -1;
            if (index >= 0) draft.messages[index] = { ...draft.messages[index], ...data.message };
          }));
        } catch {}
      },
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
  useLazyGetChatMessageContextQuery,
  useSendChatMessageMutation,
  useUploadChatAttachmentMutation,
  useDeleteChatAttachmentMutation,
  useToggleChatReactionMutation,
  useSendChatTypingMutation,
  useMarkChatReadMutation,
  useDeleteChatMessageMutation,
  useEditChatMessageMutation,
} = chatApi;
