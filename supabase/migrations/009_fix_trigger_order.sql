-- 009_fix_trigger_order.sql

-- Drop the old triggers first
DROP TRIGGER IF EXISTS on_auth_user_accept_invitations ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create them with new names to guarantee alphabetical execution order

-- 1. Create Profile First
CREATE TRIGGER a1_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Then process invitations
CREATE TRIGGER a2_on_auth_user_accept_invitations
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_accept_pending_invitations();
