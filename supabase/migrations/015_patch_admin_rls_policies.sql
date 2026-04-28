-- Hardening: ensure admin detection for RLS uses raw JWT/app metadata
-- This mitigates cases where public.profiles is stale/missing.

-- Boolean helpers
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    public.normalize_user_role(
      COALESCE(
        (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()),
        (SELECT u.raw_user_meta_data->>'role' FROM auth.users u WHERE u.id = auth.uid()),
        auth.jwt() -> 'user_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata' ->> 'role',
        'community_member'
      )
    ) = 'admin'::user_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organization()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    public.normalize_user_role(
      COALESCE(
        (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()),
        (SELECT u.raw_user_meta_data->>'role' FROM auth.users u WHERE u.id = auth.uid()),
        auth.jwt() -> 'user_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata' ->> 'role',
        'community_member'
      )
    ) = 'organization'::user_role
  );
$$;

-- Organizations: allow admins to read regardless of status filtering.
DROP POLICY IF EXISTS "orgs_select_approved" ON public.organizations;
CREATE POLICY "orgs_select_approved"
  ON public.organizations FOR SELECT
  USING (
    status = 'approved'
    OR owner_id = auth.uid()
    OR public.is_admin()
  );

-- Profiles: allow admins and organization users to read relevant profiles for joins.
DROP POLICY IF EXISTS "profiles_select_for_orgs" ON public.profiles;
CREATE POLICY "profiles_select_for_orgs"
  ON public.profiles FOR SELECT
  USING (
    public.is_organization()
    OR public.is_admin()
  );

-- Service requests: allow admins to read.
-- Also preserve org access via assigned_org_id -> user's org ids.
DROP POLICY IF EXISTS "requests_select_member" ON public.service_requests;
CREATE POLICY "requests_select_member"
  ON public.service_requests FOR SELECT
  USING (
    member_id = auth.uid()
    OR assigned_org_id IN (SELECT * FROM public.get_my_org_ids())
    OR public.is_admin()
  );

