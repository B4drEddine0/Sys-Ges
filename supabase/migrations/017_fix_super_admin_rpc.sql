-- 017_fix_super_admin_rpc.sql

-- Replace the RPC to avoid querying auth.users which sometimes throws permission errors
-- even in SECURITY DEFINER functions depending on the Supabase project configuration.

CREATE OR REPLACE FUNCTION get_system_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_super_admin BOOLEAN,
  created_at TIMESTAMPTZ
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
    p.id,
    p.email,
    p.display_name,
    p.avatar_url,
    p.is_super_admin,
    p.created_at
  FROM public.profiles p;
END;
$$;
