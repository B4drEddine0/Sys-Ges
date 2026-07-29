-- 011_join_chat_rpc.sql

CREATE OR REPLACE FUNCTION join_chat_by_code(p_join_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chat_id UUID;
BEGIN
  -- Find the chat by code
  SELECT id INTO v_chat_id
  FROM public.chats
  WHERE join_code = p_join_code;

  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  -- Insert member if not already
  INSERT INTO public.chat_members (chat_id, user_id)
  VALUES (v_chat_id, auth.uid())
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  RETURN v_chat_id;
END;
$$;
