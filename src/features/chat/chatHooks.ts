import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, type Chat, type ChatMessage } from './chatApi';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

export const chatKeys = {
  all: ['chats'] as const,
  messages: (chatId: string) => ['chat_messages', chatId] as const,
};

export function useChatsQuery() {
  return useQuery({
    queryKey: chatKeys.all,
    queryFn: chatApi.getMyChats,
  });
}

export function useChatMessagesQuery(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(chatId!),
    queryFn: () => chatApi.getMessages(chatId!),
    enabled: !!chatId,
    refetchInterval: 3000, // Robust fallback if WebSockets disconnect
  });
}

export function useChatMembersQuery(chatId: string | null) {
  return useQuery({
    queryKey: ['chat_members', chatId],
    queryFn: () => chatApi.getChatMembers(chatId!),
    enabled: !!chatId,
  });
}

export function useChatMutations() {
  const queryClient = useQueryClient();

  const createChat = useMutation({
    mutationFn: chatApi.createChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });

  const joinChat = useMutation({
    mutationFn: chatApi.joinChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });

  const sendMessage = useMutation({
    mutationFn: ({ chatId, content, file }: { chatId: string; content: string; file?: File }) => 
      chatApi.sendMessage(chatId, content, file),
    onSuccess: (_, { chatId }) => {
      // Invalidate specific chat's messages if you want, but realtime should handle it
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: ({ messageId, filePath }: { messageId: string; filePath?: string | null }) =>
      chatApi.deleteMessage(messageId, filePath),
    onSuccess: () => {
      // Realtime or polling will clean this up, but we can invalidate all chats to be safe
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    }
  });

  return { createChat, joinChat, sendMessage, deleteMessage };
}

export function useChatRealtime(activeChatId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('global-chat-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        (payload) => {
          // If the message belongs to the currently active chat, invalidate those messages
          if (payload.new && 'chat_id' in payload.new && payload.new.chat_id === activeChatId) {
            void queryClient.invalidateQueries({ queryKey: chatKeys.messages(activeChatId) });
          }
          if (payload.old && 'chat_id' in payload.old && payload.old.chat_id === activeChatId) {
            void queryClient.invalidateQueries({ queryKey: chatKeys.messages(activeChatId) });
          }
          
          // Always invalidate the chat list to update unread counters globally
          void queryClient.invalidateQueries({ queryKey: chatKeys.all });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeChatId, queryClient]);
}
