import { supabase } from '@/lib/supabase';


function assertNoError(error: any) {
  if (error) {
    throw error;
  }
}

export interface Chat {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { id: string; display_name: string; avatar_url?: string };
}

export const chatApi = {
  async getMyChats(): Promise<Chat[]> {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .order('created_at', { ascending: false });
    assertNoError(error);
    return data || [];
  },

  async createChat(name: string): Promise<Chat> {
    const { data: chat, error } = await supabase.rpc('create_group_chat', {
      p_name: name
    });
    
    assertNoError(error);
    if (!chat) throw new Error('Failed to create chat');
    
    return chat;
  },

  async joinChat(joinCode: string): Promise<Chat> {
    const { data: chatId, error } = await supabase.rpc('join_chat_by_code', {
      p_join_code: joinCode
    });

    if (error || !chatId) throw new Error(error?.message || 'Invalid join code');

    // Fetch the chat details now that we are a member
    const { data: chat, error: fetchError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (fetchError || !chat) throw new Error('Failed to fetch chat details after joining');

    return chat;
  },

  async getMessages(chatId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, profile:profiles(*)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    assertNoError(error);
    return data || [];
  },

  async sendMessage(chatId: string, content: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        user_id: userData.user.id,
        content
      });
    assertNoError(error);
  }
};
