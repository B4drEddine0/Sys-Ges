import { supabase } from '@/lib/supabase';

export interface ScreenShareSession {
  id: string;
  chat_id: string;
  sharer_id: string;
  status: 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
  sharer?: { id: string; display_name: string; avatar_url: string | null };
}

export const screenShareApi = {
  /**
   * Fetch the currently active screen share session for a chat (if any).
   */
  async getActiveSession(chatId: string): Promise<ScreenShareSession | null> {
    const { data, error } = await supabase
      .from('screen_share_sessions')
      .select('*, sharer:profiles!screen_share_sessions_sharer_id_fkey(id, display_name, avatar_url)')
      .eq('chat_id', chatId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[ScreenShare] getActiveSession error:', error);
      return null;
    }
    return data as ScreenShareSession | null;
  },

  /**
   * Start a new screen share session for the current user in a chat.
   * Returns the newly created session.
   */
  async startSession(chatId: string): Promise<ScreenShareSession> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    // End any stale sessions by this user in this chat first
    await supabase
      .from('screen_share_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('sharer_id', userData.user.id)
      .eq('status', 'active');

    const { data, error } = await supabase
      .from('screen_share_sessions')
      .insert({ chat_id: chatId, sharer_id: userData.user.id, status: 'active' })
      .select('*, sharer:profiles!screen_share_sessions_sharer_id_fkey(id, display_name, avatar_url)')
      .single();

    if (error) throw new Error(`Failed to start session: ${error.message}`);
    return data as ScreenShareSession;
  },

  /**
   * End a screen share session. Uses the SECURITY DEFINER RPC for a clean atomic update.
   */
  async endSession(sessionId: string): Promise<void> {
    const { error } = await supabase.rpc('end_screen_share_session', {
      p_session_id: sessionId,
    });
    if (error) {
      console.error('[ScreenShare] endSession error:', error);
      // Fallback: try direct update
      await supabase
        .from('screen_share_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId);
    }
  },
};
