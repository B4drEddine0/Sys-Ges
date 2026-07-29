-- ============================================================
-- NUCLEAR RESET: Drop ALL policies on projects & project_members
-- then rebuild them cleanly from scratch
-- ============================================================

-- Step 1: Temporarily disable RLS to verify the issue is policies
-- (not a schema problem)
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on these two tables
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE tablename IN ('projects', 'project_members')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Step 3: Make sure the helper functions exist
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

-- Step 4: Re-enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Step 5: Create clean policies for projects
CREATE POLICY "projects_select"
  ON projects FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_my_project_ids()));

CREATE POLICY "projects_insert"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "projects_update"
  ON projects FOR UPDATE
  TO authenticated
  USING (public.is_project_admin(id));

CREATE POLICY "projects_delete"
  ON projects FOR DELETE
  TO authenticated
  USING (public.is_project_owner(id));

-- Step 6: Create clean policies for project_members
CREATE POLICY "project_members_select"
  ON project_members FOR SELECT
  TO authenticated
  USING (project_id IN (SELECT public.get_my_project_ids()));

CREATE POLICY "project_members_insert"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow inserting yourself (becoming owner when creating a project)
    user_id = auth.uid()
    OR
    -- Allow admins/owners to add others
    public.is_project_admin(project_id)
  );

CREATE POLICY "project_members_update"
  ON project_members FOR UPDATE
  TO authenticated
  USING (public.is_project_admin(project_id));

CREATE POLICY "project_members_delete"
  ON project_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_project_admin(project_id)
  );

-- Verify all policies were created
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('projects', 'project_members')
ORDER BY tablename, cmd;
