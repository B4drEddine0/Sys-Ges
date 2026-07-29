-- ============================================================
-- PHASE 1: MULTI-USER COLLABORATIVE SAAS DATABASE MIGRATION
-- ============================================================
-- This migration transforms the single-user task manager into
-- a multi-user collaborative SaaS with proper auth, projects,
-- roles, RLS, and data migration.
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE (linked to Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================================
-- 2. PROJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2563eb',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_created_by ON projects(created_by);

-- ============================================================
-- 3. PROJECT MEMBERS TABLE
-- ============================================================
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- ============================================================
-- 4. PROJECT INVITATIONS TABLE
-- ============================================================
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  status invitation_status NOT NULL DEFAULT 'pending',
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX idx_invitations_email ON project_invitations(invited_email);
CREATE INDEX idx_invitations_project ON project_invitations(project_id);
CREATE INDEX idx_invitations_token ON project_invitations(token);

-- ============================================================
-- 5. ADD project_id TO EXISTING TABLES
-- ============================================================

-- Tasks: add project_id column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

-- Sections: add project_id column
ALTER TABLE sections ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sections_project ON sections(project_id);

-- Labels: add project_id column
ALTER TABLE labels ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_labels_project ON labels(project_id);

-- Activities: add project_id column
ALTER TABLE activities ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);

-- ============================================================
-- 6. ADDITIONAL USEFUL INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(section_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_task ON activities(task_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);

-- ============================================================
-- 7. AUTO-CREATE PROFILE ON USER REGISTRATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 8. AUTO-ACCEPT PENDING INVITATIONS ON USER REGISTRATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_accept_pending_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- For each pending invitation for this email, add them as a member
  INSERT INTO public.project_members (project_id, user_id, role)
  SELECT pi.project_id, NEW.id, pi.role
  FROM public.project_invitations pi
  WHERE pi.invited_email = COALESCE(NEW.email, '')
    AND pi.status = 'pending'
    AND pi.expires_at > now()
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- Mark those invitations as accepted
  UPDATE public.project_invitations
  SET status = 'accepted'
  WHERE invited_email = COALESCE(NEW.email, '')
    AND status = 'pending'
    AND expires_at > now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_accept_invitations ON auth.users;
CREATE TRIGGER on_auth_user_accept_invitations
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_accept_pending_invitations();

-- ============================================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. RLS POLICIES — PROFILES
-- ============================================================
-- Users can read any profile (for showing avatars/names)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update only their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can insert their own profile (for the trigger)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 11. RLS POLICIES — PROJECTS
-- ============================================================
-- Users can see projects they are members of
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
CREATE POLICY "Users can view their projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- Any authenticated user can create a project
DROP POLICY IF EXISTS "Users can create projects" ON projects;
CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Only owner/admin can update a project
DROP POLICY IF EXISTS "Owners and admins can update projects" ON projects;
CREATE POLICY "Owners and admins can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Only owner can delete a project
DROP POLICY IF EXISTS "Owners can delete projects" ON projects;
CREATE POLICY "Owners can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ============================================================
-- 12. RLS POLICIES — PROJECT MEMBERS
-- ============================================================
DROP POLICY IF EXISTS "Members can view project members" ON project_members;
CREATE POLICY "Members can view project members"
  ON project_members FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can add members" ON project_members;
CREATE POLICY "Owners and admins can add members"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS "Owners and admins can update members" ON project_members;
CREATE POLICY "Owners and admins can update members"
  ON project_members FOR UPDATE
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin'))
  );

-- Members can remove themselves (leave), owners/admins can remove others
DROP POLICY IF EXISTS "Members can leave or owners can remove" ON project_members;
CREATE POLICY "Members can leave or owners can remove"
  ON project_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin'))
  );

-- ============================================================
-- 13. RLS POLICIES — PROJECT INVITATIONS
-- ============================================================
DROP POLICY IF EXISTS "Members can view project invitations" ON project_invitations;
CREATE POLICY "Members can view project invitations"
  ON project_invitations FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can create invitations" ON project_invitations;
CREATE POLICY "Owners and admins can create invitations"
  ON project_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS "Owners and admins can update invitations" ON project_invitations;
CREATE POLICY "Owners and admins can update invitations"
  ON project_invitations FOR UPDATE
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin'))
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can delete invitations" ON project_invitations;
CREATE POLICY "Owners and admins can delete invitations"
  ON project_invitations FOR DELETE
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin'))
  );

-- ============================================================
-- 14. RLS POLICIES — TASKS (scoped to project membership)
-- ============================================================
DROP POLICY IF EXISTS "Members can view project tasks" ON tasks;
CREATE POLICY "Members can view project tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can create project tasks" ON tasks;
CREATE POLICY "Members can create project tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can update project tasks" ON tasks;
CREATE POLICY "Members can update project tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can delete project tasks" ON tasks;
CREATE POLICY "Members can delete project tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

-- ============================================================
-- 15. RLS POLICIES — SECTIONS
-- ============================================================
DROP POLICY IF EXISTS "Members can view project sections" ON sections;
CREATE POLICY "Members can view project sections"
  ON sections FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can create project sections" ON sections;
CREATE POLICY "Members can create project sections"
  ON sections FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can update project sections" ON sections;
CREATE POLICY "Members can update project sections"
  ON sections FOR UPDATE
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can delete project sections" ON sections;
CREATE POLICY "Members can delete project sections"
  ON sections FOR DELETE
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin'))
  );

-- ============================================================
-- 16. RLS POLICIES — LABELS
-- ============================================================
DROP POLICY IF EXISTS "Members can view project labels" ON labels;
CREATE POLICY "Members can view project labels"
  ON labels FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can create project labels" ON labels;
CREATE POLICY "Members can create project labels"
  ON labels FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can update project labels" ON labels;
CREATE POLICY "Members can update project labels"
  ON labels FOR UPDATE
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can delete project labels" ON labels;
CREATE POLICY "Members can delete project labels"
  ON labels FOR DELETE
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

-- ============================================================
-- 17. RLS POLICIES — ACTIVITIES
-- ============================================================
DROP POLICY IF EXISTS "Members can view project activities" ON activities;
CREATE POLICY "Members can view project activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can create project activities" ON activities;
CREATE POLICY "Members can create project activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

-- ============================================================
-- 18. DROP OLD USERS TABLE (replaced by profiles + Supabase Auth)
-- ============================================================
-- We keep the users table for now since existing data references it.
-- We'll clean it up after migrating assignee references.
-- The old "users" table will be dropped at the end of migration.

-- ============================================================
-- 19. ENABLE REALTIME FOR KEY TABLES
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE sections;
ALTER PUBLICATION supabase_realtime ADD TABLE labels;
ALTER PUBLICATION supabase_realtime ADD TABLE project_members;

-- ============================================================
-- 20. UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to profiles
DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Apply to projects
DROP TRIGGER IF EXISTS set_projects_updated_at ON projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
