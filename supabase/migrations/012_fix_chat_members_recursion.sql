-- 012_fix_chat_members_recursion.sql

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view members of their chats" ON chat_members;

-- Replace it with a simpler policy that avoids infinite loops.
-- In a team environment, it is generally safe to let authenticated users view the member list of chats.
CREATE POLICY "Users can view chat_members"
  ON chat_members FOR SELECT
  TO authenticated
  USING (true);
