-- Tighten organization_members read policies and make org resolver null-safe.
DROP POLICY IF EXISTS "org_members_select_own" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_select_same_org" ON public.organization_members;

CREATE POLICY "org_members_select_own"
  ON public.organization_members
  FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "org_members_select_same_org"
  ON public.organization_members
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE profile_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE profile_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;
