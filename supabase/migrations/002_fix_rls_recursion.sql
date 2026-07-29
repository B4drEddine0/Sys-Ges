-- ============================================================
-- FIX: Infinite recursion in project_members RLS policies
-- ============================================================
-- Problem: The "Members can view project members" policy does a
-- subquery back to project_members itself, causing infinite recursion.
--
-- Solution: Use a SECURITY DEFINER function that bypasses RLS to
-- get the current user's project IDs. All policies that need to
-- check "is this user a member?" use this function instead.
-- ============================================================

-- Step 1: Create a SECURITY DEFINER function that returns the
-- project IDs the current user is a member of.
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS.
CREATE OR REPLACE FUNCTION public.get_my_project_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT project_id
  FROM public.project_members
  WHERE user_id = auth.uid();
$$;

-- Also create a helper to check if the user is owner/admin of a project
CREATE OR REPLACE FUNCTION public.is_project_admin(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

-- ============================================================
-- Step 2: Fix ALL policies that had the recursion issue
-- ============================================================

-- PROJECT MEMBERS — fix the recursive policies
DROP POLICY IF EXISTS "Members can view project members" ON project_members;
CREATE POLICY "Members can view project members"
  ON project_members FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Owners and admins can add members" ON project_members;
CREATE POLICY "Owners and admins can add members"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_project_admin(project_id)
  );

DROP POLICY IF EXISTS "Owners and admins can update members" ON project_members;
CREATE POLICY "Owners and admins can update members"
  ON project_members FOR UPDATE
  TO authenticated
  USING (
    public.is_project_admin(project_id)
  );

DROP POLICY IF EXISTS "Members can leave or owners can remove" ON project_members;
CREATE POLICY "Members can leave or owners can remove"
  ON project_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_project_admin(project_id)
  );

-- PROJECTS — fix the policies that subquery project_members
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
CREATE POLICY "Users can view their projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Owners and admins can update projects" ON projects;
CREATE POLICY "Owners and admins can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    public.is_project_admin(id)
  );

DROP POLICY IF EXISTS "Owners can delete projects" ON projects;
CREATE POLICY "Owners can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    public.is_project_owner(id)
  );

-- TASKS
DROP POLICY IF EXISTS "Members can view project tasks" ON tasks;
CREATE POLICY "Members can view project tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can create project tasks" ON tasks;
CREATE POLICY "Members can create project tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can update project tasks" ON tasks;
CREATE POLICY "Members can update project tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can delete project tasks" ON tasks;
CREATE POLICY "Members can delete project tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

-- SECTIONS
DROP POLICY IF EXISTS "Members can view project sections" ON sections;
CREATE POLICY "Members can view project sections"
  ON sections FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can create project sections" ON sections;
CREATE POLICY "Members can create project sections"
  ON sections FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can update project sections" ON sections;
CREATE POLICY "Members can update project sections"
  ON sections FOR UPDATE
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can delete project sections" ON sections;
CREATE POLICY "Members can delete project sections"
  ON sections FOR DELETE
  TO authenticated
  USING (
    public.is_project_admin(project_id)
  );

-- LABELS
DROP POLICY IF EXISTS "Members can view project labels" ON labels;
CREATE POLICY "Members can view project labels"
  ON labels FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can create project labels" ON labels;
CREATE POLICY "Members can create project labels"
  ON labels FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can update project labels" ON labels;
CREATE POLICY "Members can update project labels"
  ON labels FOR UPDATE
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can delete project labels" ON labels;
CREATE POLICY "Members can delete project labels"
  ON labels FOR DELETE
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

-- ACTIVITIES
DROP POLICY IF EXISTS "Members can view project activities" ON activities;
CREATE POLICY "Members can view project activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );

DROP POLICY IF EXISTS "Members can create project activities" ON activities;
CREATE POLICY "Members can create project activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT public.get_my_project_ids())
  );

-- PROJECT INVITATIONS
DROP POLICY IF EXISTS "Members can view project invitations" ON project_invitations;
CREATE POLICY "Members can view project invitations"
  ON project_invitations FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can create invitations" ON project_invitations;
CREATE POLICY "Owners and admins can create invitations"
  ON project_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_project_admin(project_id)
  );

DROP POLICY IF EXISTS "Owners and admins can update invitations" ON project_invitations;
CREATE POLICY "Owners and admins can update invitations"
  ON project_invitations FOR UPDATE
  TO authenticated
  USING (
    public.is_project_admin(project_id)
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can delete invitations" ON project_invitations;
CREATE POLICY "Owners and admins can delete invitations"
  ON project_invitations FOR DELETE
  TO authenticated
  USING (
    public.is_project_admin(project_id)
  );

-- ============================================================
-- Step 3: Special INSERT policy for project_members
-- When a user creates a project, they need to insert themselves
-- as the owner BEFORE any membership check can pass.
-- We allow inserting a row where user_id = auth.uid() always.
-- ============================================================
DROP POLICY IF EXISTS "Users can insert themselves as owner on new project" ON project_members;
CREATE POLICY "Users can insert themselves as owner on new project"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_project_admin(project_id)
  );
