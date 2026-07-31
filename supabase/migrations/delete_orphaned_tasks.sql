-- Run this script in the Supabase SQL Editor to delete tasks that have no section

-- Delete tasks where the section_id is completely empty or null
DELETE FROM public.tasks 
WHERE section_id IS NULL 
   OR trim(section_id) = '';

-- OPTIONAL: If you want to also delete tasks whose sections no longer exist in the project_sections table:
-- Uncomment the following block to run it:
/*
DELETE FROM public.tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM public.sections s
  WHERE s.id::text = t.section_id
) 
-- Ensure we don't delete standard frontend/backend default string sections if you use them
AND t.section_id NOT IN ('frontend', 'backend');
*/
