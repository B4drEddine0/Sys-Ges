-- Insert missing profiles for any existing users in auth.users
INSERT INTO public.profiles (id, display_name, email, avatar_url)
SELECT 
  id,
  COALESCE(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)),
  COALESCE(email, ''),
  raw_user_meta_data ->> 'avatar_url'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
