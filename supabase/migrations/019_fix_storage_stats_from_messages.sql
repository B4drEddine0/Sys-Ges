-- 019_fix_storage_stats_from_messages.sql

-- Querying storage.objects from the frontend directly is prone to RLS and schema path issues.
-- Since we now track file_size directly in chat_messages, we can safely and instantly
-- aggregate the stats from our own table without touching the storage schema!

CREATE OR REPLACE FUNCTION get_system_storage_stats()
RETURNS TABLE (
  total_size BIGINT,
  file_count BIGINT,
  oldest_file TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
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
    COALESCE(SUM(file_size), 0) as total_size,
    COUNT(id) as file_count,
    MIN(created_at) as oldest_file
  FROM public.chat_messages
  WHERE file_size IS NOT NULL AND file_size > 0;
END;
$$;
