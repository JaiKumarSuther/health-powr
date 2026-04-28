-- Fix recursive RLS on organization_members and unblock provider request reads.
-- Symptoms addressed:
-- - organization_members -> 500 (PostgREST 42P17: infinite recursion)
-- - service_requests join query -> 403 (PostgREST 42501) for organization users

-- Ensure authenticated role can read the relevant tables (RLS still enforced).
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.organization_members TO authenticated;
GRANT SELECT ON TABLE public.service_requests TO authenticated;
GRANT SELECT ON TABLE public.request_notes TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- A SECURITY DEFINER helper avoids recursive policy evaluation on organization_members.
CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.profile_id = auth.uid()
$$;

-- Make get_user_org_id use the non-recursive helper.
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.get_my_org_ids()
  LIMIT 1
$$;

-- Remove potentially recursive/overlapping policies.
DROP POLICY IF EXISTS "org_members_select" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_select_own" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_select_same_org" ON public.organization_members;

-- Safe organization_members read policies (non-recursive).
CREATE POLICY "org_members_select_own"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "org_members_select_same_org"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT * FROM public.get_my_org_ids()));

-- Recreate service_requests SELECT policy using non-recursive helper.
DROP POLICY IF EXISTS "requests_select_member" ON public.service_requests;
CREATE POLICY "requests_select_member"
  ON public.service_requests
  FOR SELECT
  TO authenticated
  USING (
    member_id = auth.uid()
    OR assigned_org_id IN (SELECT * FROM public.get_my_org_ids())
    OR get_user_role() = 'admin'
  );
