import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { screenShareApi, type ScreenShareSession } from './screenShareApi';

/**
 * Subscribes to the active screen share session in a given chat room.
 * Uses Supabase Realtime Postgres CDC to detect when sessions are created or ended.
 *
 * Returns null if no active session, or the session object if someone is sharing.
 * The sharer themselves sees their own session; this is intentional and used
 * to show the "You are sharing" controls.
 */
export function useActiveScreenShareSession(chatId: string | null): ScreenShareSession | null {
  const [activeSession, setActiveSession] = useState<ScreenShareSession | null>(null);

  useEffect(() => {
    if (!chatId) {
      setActiveSession(null);
      return;
    }

    // Fetch the current active session on mount / chat switch
    let cancelled = false;
    screenShareApi.getActiveSession(chatId).then((session) => {
      if (!cancelled) setActiveSession(session);
    });

    // Subscribe to Postgres changes on screen_share_sessions for this chat
    const channel = supabase
      .channel(`screen-share-presence:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'screen_share_sessions',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          // On any change, refetch the current active session
          // This handles both INSERT (new session) and UPDATE (session ended)
          const session = await screenShareApi.getActiveSession(chatId);
          setActiveSession(session);

          // Also check if the payload is an UPDATE that set status to ended
          if (
            payload.eventType === 'UPDATE' &&
            'status' in payload.new &&
            payload.new.status === 'ended'
          ) {
            setActiveSession(null);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [chatId]);

  return activeSession;
}
