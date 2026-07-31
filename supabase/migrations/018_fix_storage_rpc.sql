-- 018_fix_storage_rpc.sql

-- Sometimes querying storage.objects from the public schema fails if search_path isn't set
-- or if the role doesn't have privileges. This explicitly grants and sets it.

GRANT USAGE ON SCHEMA storage TO postgres, authenticated, anon;
GRANT SELECT ON storage.objects TO postgres, authenticated, anon;

CREATE OR REPLACE FUNCTION get_system_storage_stats()
RETURNS TABLE (
  total_size BIGINT,
  file_count BIGINT,
  oldest_file TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- Check if the calling user is a super admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Super admin only.';
  END IF;

  RETURN QUERY 
  SELECT 
    COALESCE(SUM((metadata->>'size')::bigint), 0) as total_size,
    COUNT(id) as file_count,
    MIN(created_at) as oldest_file
  FROM storage.objects
  WHERE bucket_id = 'chat_attachments';
END;
$$;

-- Create an RPC to let Super Admins change a user's display name
CREATE OR REPLACE FUNCTION admin_update_user_name(p_user_id UUID, p_new_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.profiles 
  SET display_name = p_new_name 
  WHERE id = p_user_id;
END;
$$;
