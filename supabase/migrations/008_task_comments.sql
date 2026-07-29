-- 008_task_comments.sql

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view task comments"
  ON task_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN project_members pm ON t.project_id = pm.project_id
      WHERE t.id = task_comments.task_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create task comments"
  ON task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN project_members pm ON t.project_id = pm.project_id
      WHERE t.id = task_comments.task_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own comments"
  ON task_comments FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;
