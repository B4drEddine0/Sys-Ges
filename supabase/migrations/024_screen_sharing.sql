-- 024_screen_sharing.sql
-- Screen sharing session registry.
-- ONLY stores lightweight metadata about who is sharing in a room.
-- The actual video stream is handled by WebRTC peer-to-peer.
-- Supabase Realtime Broadcast channels are used for WebRTC signaling (not Postgres CDC).

CREATE TABLE IF NOT EXISTS public.screen_share_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sharer_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 'active' = live, 'ended' = done
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.screen_share_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: only chat members can see sessions for their chats
CREATE POLICY "chat_members_can_view_share_sessions"
  ON public.screen_share_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_id = screen_share_sessions.chat_id
        AND user_id = auth.uid()
    )
  );

-- INSERT: only a chat member can start a session as themselves
CREATE POLICY "chat_members_can_start_share_session"
  ON public.screen_share_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    sharer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_id = screen_share_sessions.chat_id
        AND user_id = auth.uid()
    )
  );

-- UPDATE: only the sharer can update their own session (e.g. mark it ended)
CREATE POLICY "sharer_can_update_share_session"
  ON public.screen_share_sessions FOR UPDATE
  TO authenticated
  USING (sharer_id = auth.uid())
  WITH CHECK (sharer_id = auth.uid());

-- DELETE: only the sharer can delete their own session
CREATE POLICY "sharer_can_delete_share_session"
  ON public.screen_share_sessions FOR DELETE
  TO authenticated
  USING (sharer_id = auth.uid());

-- Enable Realtime so viewers can reactively detect session start/end events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'screen_share_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.screen_share_sessions;
  END IF;
END $$;

-- Helper RPC: end a screen share session atomically.
-- Called by the sharer when they stop sharing. SECURITY DEFINER ensures
-- the update bypasses RLS but still validates ownership via auth.uid().
CREATE OR REPLACE FUNCTION public.end_screen_share_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.screen_share_sessions
  SET status = 'ended', ended_at = NOW()
  WHERE id = p_session_id
    AND sharer_id = auth.uid();  -- only the sharer can end their own session
END;
$$;

-- Helper RPC: clean up stale active sessions (e.g. sharer closed tab without stopping).
-- Sessions active for more than 8 hours are considered stale.
CREATE OR REPLACE FUNCTION public.cleanup_stale_share_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.screen_share_sessions
  SET status = 'ended', ended_at = NOW()
  WHERE status = 'active'
    AND started_at < NOW() - INTERVAL '8 hours';
END;
$$;