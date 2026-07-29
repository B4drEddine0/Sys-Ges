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
    mutationFn: ({ chatId, content }: { chatId: string; content: string }) => 
      chatApi.sendMessage(chatId, content),
    onSuccess: (_, { chatId }) => {
      // Invalidate specific chat's messages if you want, but realtime should handle it
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
    },
  });

  return { createChat, joinChat, sendMessage };
}

export function useChatRealtime(chatId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, queryClient]);
}
