-- ============================================================
-- FIX: "new row violates row-level security policy for table projects"
-- The projects INSERT policy is missing. This adds it.
-- ============================================================

-- Fix the INSERT policy for projects (allow any authenticated user to create a project)
DROP POLICY IF EXISTS "Users can create projects" ON projects;
CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Also fix the project_members INSERT policy (needed when adding yourself as owner)
-- This replaces both INSERT policies with one that covers all cases:
DROP POLICY IF EXISTS "Owners and admins can add members" ON project_members;
DROP POLICY IF EXISTS "Users can insert themselves as owner on new project" ON project_members;
CREATE POLICY "project_members_insert"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow inserting yourself (e.g., as owner when creating a project)
    user_id = auth.uid()
    OR
    -- Allow admins/owners to add others
    public.is_project_admin(project_id)
  );
