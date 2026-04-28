-- Storage policies for avatars bucket
-- Fixes: 403 "new row violates row-level security policy" on upload
-- Expected object path: <auth.uid()>/avatar.<ext>

-- Ensure we don't end up with multiple permissive policies
DROP POLICY IF EXISTS "avatars: users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "avatars: users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "avatars: users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "avatars: public read" ON storage.objects;
DROP POLICY IF EXISTS "avatars: users can read own files" ON storage.objects;

-- Public read (safe for profile photos). If you prefer private avatars,
-- remove this policy and rely on signed URLs instead.
CREATE POLICY "avatars: public read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Allow authenticated users to upload only inside their own folder
CREATE POLICY "avatars: users can upload own files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to overwrite/update only their own files
CREATE POLICY "avatars: users can update own files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Optional: allow users to delete their own avatar objects
CREATE POLICY "avatars: users can delete own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

