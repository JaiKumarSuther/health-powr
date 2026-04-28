-- Add missing RLS policies for organization_members table

CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT
  USING (
    profile_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE profile_id = auth.uid()
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "org_members_insert"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "org_members_update"
  ON public.organization_members FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE profile_id = auth.uid()
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "org_members_delete"
  ON public.organization_members FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE profile_id = auth.uid()
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
