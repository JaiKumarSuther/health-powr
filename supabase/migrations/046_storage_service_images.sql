-- Public service images bucket + policies.
-- Expected object path: <auth.uid()>/service-<serviceId>-<timestamp>.<ext>

-- Create bucket if missing (public read)
insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do update set public = true;

-- Clean up any previous policies with same names
drop policy if exists "service-images: public read" on storage.objects;
drop policy if exists "service-images: users can upload own files" on storage.objects;
drop policy if exists "service-images: users can update own files" on storage.objects;
drop policy if exists "service-images: users can delete own files" on storage.objects;

-- Public read
create policy "service-images: public read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'service-images');

-- Authenticated users can upload/update/delete only in their own folder
create policy "service-images: users can upload own files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'service-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "service-images: users can update own files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'service-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'service-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "service-images: users can delete own files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'service-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


