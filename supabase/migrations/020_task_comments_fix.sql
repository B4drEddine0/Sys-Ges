-- 020_task_comments_fix.sql

-- Drop the old legacy task_comments table if it exists
DROP TABLE IF EXISTS public.task_comments CASCADE;

-- Recreate the modern task_comments table
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Allow reading comments if the user is a member of the project the task belongs to
CREATE POLICY "Users can view comments of project tasks" ON public.task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON t.project_id = pm.project_id
      WHERE t.id = task_comments.task_id
      AND pm.user_id = auth.uid()
    )
  );

-- Allow creating comments if the user is a member of the project
CREATE POLICY "Users can create comments on project tasks" ON public.task_comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON t.project_id = pm.project_id
      WHERE t.id = task_id
      AND pm.user_id = auth.uid()
    )
  );

-- Allow authors to delete their own comments
CREATE POLICY "Authors can delete their comments" ON public.task_comments
  FOR DELETE USING (auth.uid() = author_id);

-- Allow authors to update their own comments
CREATE POLICY "Authors can update their comments" ON public.task_comments
  FOR UPDATE USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Enable realtime for task_comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'task_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
  END IF;
END $$;
