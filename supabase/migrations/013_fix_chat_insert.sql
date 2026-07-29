-- 013_fix_chat_insert.sql

-- Drop the old policy that was blocking the RETURNING clause
DROP POLICY IF EXISTS "Users can create chats" ON chats;

-- Create an RPC to safely create a chat and join it in one secure transaction
CREATE OR REPLACE FUNCTION create_group_chat(p_name TEXT)
RETURNS public.chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chat public.chats;
BEGIN
  -- 1. Insert the new chat
  INSERT INTO public.chats (name)
  VALUES (p_name)
  RETURNING * INTO v_chat;

  -- 2. Immediately add the creator as a member
  INSERT INTO public.chat_members (chat_id, user_id)
  VALUES (v_chat.id, auth.uid());

  -- 3. Return the chat object
  RETURN v_chat;
END;
$$;
