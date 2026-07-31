-- 022_chat_read_receipts.sql

-- Add last_read_at to chat_members
ALTER TABLE public.chat_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Function to update last_read_at
CREATE OR REPLACE FUNCTION public.update_chat_last_read(p_chat_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.chat_members
  SET last_read_at = NOW()
  WHERE chat_id = p_chat_id AND user_id = auth.uid();
END;
$$;

-- Function to get chats with unread counts
CREATE OR REPLACE FUNCTION public.get_my_chats_with_unread()
RETURNS TABLE (
  id UUID,
  name TEXT,
  join_code TEXT,
  created_at TIMESTAMPTZ,
  unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id, 
    c.name, 
    c.join_code, 
    c.created_at,
    (
      SELECT COUNT(*) 
      FROM public.chat_messages cm
      WHERE cm.chat_id = c.id
      AND cm.user_id != auth.uid()
      AND cm.created_at > mem.last_read_at
    ) as unread_count
  FROM public.chats c
  JOIN public.chat_members mem ON mem.chat_id = c.id
  WHERE mem.user_id = auth.uid()
  ORDER BY c.created_at DESC;
END;
$$;
