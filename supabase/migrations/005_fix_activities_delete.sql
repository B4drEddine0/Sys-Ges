-- Add missing DELETE policy for activities to allow task deletion to CASCADE
DROP POLICY IF EXISTS "Members can delete project activities" ON activities;
CREATE POLICY "Members can delete project activities"
  ON activities FOR DELETE
  TO authenticated
  USING (
    project_id IN (SELECT public.get_my_project_ids())
  );
