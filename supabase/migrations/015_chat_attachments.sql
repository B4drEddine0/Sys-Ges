-- 015_chat_attachments.sql

-- 1. Add attachment columns to chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 2. Create the storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat_attachments',
  'chat_attachments',
  true, -- Public read for easy rendering
  524288000, -- 500MB limit per file
  null
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 524288000;

-- 3. Set up Storage RLS Policies
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload chat attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat_attachments');

-- Allow authenticated users to update/delete their own files
CREATE POLICY "Users can manage their own chat attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'chat_attachments' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own chat attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat_attachments' AND auth.uid() = owner);

-- Allow everyone to read attachments
CREATE POLICY "Anyone can view chat attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat_attachments');

-- 4. Enable pg_cron (if available) to auto-delete files older than 12 hours to save 1GB limit
-- Note: If pg_cron is not enabled on this Supabase instance, this block will gracefully be skipped or user can enable it in dashboard.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to clean up old attachments
CREATE OR REPLACE FUNCTION cleanup_old_chat_attachments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Delete the actual files from Supabase storage
  -- We delete files older than 12h, OR files larger than 10MB that are older than 1h
  DELETE FROM storage.objects 
  WHERE bucket_id = 'chat_attachments' 
  AND (
    created_at < NOW() - INTERVAL '12 hours'
    OR (
      (metadata->>'size')::bigint > 10485760 
      AND created_at < NOW() - INTERVAL '1 hour'
    )
  );

  -- 2. Nullify the file references in chat_messages so UI knows it expired
  UPDATE public.chat_messages
  SET file_path = NULL, file_name = 'Expired File', file_size = 0, file_type = NULL
  WHERE file_path IS NOT NULL 
  AND (
    created_at < NOW() - INTERVAL '12 hours'
    OR (
      file_size > 10485760 
      AND created_at < NOW() - INTERVAL '1 hour'
    )
  );
END;
$$;

-- Schedule the cleanup to run every hour
SELECT cron.schedule(
  'cleanup-chat-attachments',
  '0 * * * *', -- Run at minute 0 of every hour
  $$SELECT cleanup_old_chat_attachments()$$
);
