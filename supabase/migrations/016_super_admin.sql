-- 016_super_admin.sql

-- 1. Add is_super_admin column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- 2. Set the specific user to super admin
UPDATE public.profiles
SET is_super_admin = true
WHERE email = 'badrdine03@gmail.com';

-- 3. Create an RPC to fetch all users in the system (for super admins only)
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
    (SELECT created_at FROM auth.users u WHERE u.id = p.id LIMIT 1) as created_at
  FROM public.profiles p;
END;
$$;

-- 4. Create an RPC to fetch all files and storage usage
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
    COALESCE(SUM((metadata->>'size')::bigint), 0) as total_size,
    COUNT(id) as file_count,
    MIN(created_at) as oldest_file
  FROM storage.objects
  WHERE bucket_id = 'chat_attachments';
END;
$$;
