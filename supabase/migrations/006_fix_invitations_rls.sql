-- Fix project_invitations RLS policies to avoid querying auth.users (which normal users cannot read)
-- We will use the user's email from their JWT token instead.

DROP POLICY IF EXISTS "Members can view project invitations" ON project_invitations;
CREATE POLICY "Members can view project invitations"
  ON project_invitations FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
    OR invited_email = (auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "Owners and admins can update invitations" ON project_invitations;
CREATE POLICY "Owners and admins can update invitations"
  ON project_invitations FOR UPDATE
  TO authenticated
  USING (
    public.is_project_admin(project_id)
    OR invited_email = (auth.jwt() ->> 'email')
  );
