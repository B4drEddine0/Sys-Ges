CREATE TABLE IF NOT EXISTS public.api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  collection_name TEXT NOT NULL DEFAULT 'General',
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  url TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  body TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, collection_name, name)
);

ALTER TABLE public.api_requests ADD COLUMN IF NOT EXISTS collection_name TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.api_requests DROP CONSTRAINT IF EXISTS api_requests_project_id_name_key;
ALTER TABLE public.api_requests DROP CONSTRAINT IF EXISTS api_requests_project_collection_name_key;
ALTER TABLE public.api_requests ADD CONSTRAINT api_requests_project_collection_name_key UNIQUE (project_id, collection_name, name);

CREATE INDEX IF NOT EXISTS idx_api_requests_project ON public.api_requests(project_id);
ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_requests_select" ON public.api_requests;
DROP POLICY IF EXISTS "api_requests_insert" ON public.api_requests;
DROP POLICY IF EXISTS "api_requests_update" ON public.api_requests;
DROP POLICY IF EXISTS "api_requests_delete" ON public.api_requests;

CREATE POLICY "api_requests_select" ON public.api_requests FOR SELECT TO authenticated
  USING (project_id IN (SELECT public.get_my_project_ids()));
CREATE POLICY "api_requests_insert" ON public.api_requests FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND project_id IN (SELECT public.get_my_project_ids()));
CREATE POLICY "api_requests_update" ON public.api_requests FOR UPDATE TO authenticated
  USING (project_id IN (SELECT public.get_my_project_ids()))
  WITH CHECK (project_id IN (SELECT public.get_my_project_ids()));
CREATE POLICY "api_requests_delete" ON public.api_requests FOR DELETE TO authenticated
  USING (project_id IN (SELECT public.get_my_project_ids()));