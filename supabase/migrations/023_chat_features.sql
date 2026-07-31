-- 023_chat_features.sql

-- Add reply support
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL;

-- Create reactions table
CREATE TABLE IF NOT EXISTS public.chat_reactions (
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for chat_reactions
CREATE POLICY "Users can view reactions in their chats"
  ON public.chat_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_members cm ON cm.chat_id = m.chat_id
      WHERE m.id = chat_reactions.message_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add reactions in their chats"
  ON public.chat_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_members cm ON cm.chat_id = m.chat_id
      WHERE m.id = message_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove their own reactions"
  ON public.chat_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable Realtime for reactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
  END IF;
END $$;
