-- 014_heal_missing_profiles.sql

-- This migration inserts a default profile for any user in auth.users that doesn't have one.
-- This heals the database if the profile creation trigger failed for any reason.

INSERT INTO public.profiles (id, email, display_name, avatar_url)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;
