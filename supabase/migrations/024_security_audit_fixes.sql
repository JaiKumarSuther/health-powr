-- ============================================================================
-- Migration 024: Security Audit Fixes
-- Fixes: SEC-04, SEC-05, SEC-06, RBAC-03, RBAC-04, RBAC-05, AUTH-01, AUTH-02
-- Date: 2026-04-13  (v2 — fixes org bootstrap flow)
-- ============================================================================

-- ============================================================================
-- AUTH-01: Prevent self-registration as admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_user_role(role_text text)
RETURNS public.user_role
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE
    WHEN role_text = 'community_member' THEN 'community_member'::public.user_role
    WHEN role_text = 'organization'     THEN 'organization'::public.user_role
    -- SECURITY: Admin role cannot be self-assigned via signup.
    ELSE 'community_member'::public.user_role
  END;
END;
$$;


-- ============================================================================
-- AUTH-02: Fix is_admin() and is_organization() to trust profile table first,
-- then app_metadata (server-set only), NOT user_metadata (client-settable).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    COALESCE(
      (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()),
      auth.jwt() -> 'app_metadata' ->> 'role',
      'community_member'
    ) = 'admin'
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
    COALESCE(
      (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()),
      auth.jwt() -> 'app_metadata' ->> 'role',
      'community_member'
    )
  ) IN ('organization');
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
    public.normalize_user_role(
      COALESCE(
        auth.jwt() -> 'app_metadata' ->> 'role',
        'community_member'
      )
    )
  );
$$;


-- ============================================================================
-- Helper: SECURITY DEFINER function to check if the current user is an
-- owner/admin of a given organization. This avoids recursive RLS evaluation
-- on organization_members when used inside INSERT/UPDATE/DELETE policies.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_org_owner_or_admin(target_org_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = target_org_id
      AND om.profile_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  );
$$;

-- Helper: SECURITY DEFINER function to check if an org has ANY members.
-- Used for first-member bootstrap.
CREATE OR REPLACE FUNCTION public.org_has_members(target_org_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = target_org_id
  );
$$;


-- ============================================================================
-- RBAC-05: Prevent users from changing their own role via direct API call.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND OLD.id = auth.uid() THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Cannot change own role. Contact an administrator.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_no_role_self_change ON public.profiles;
CREATE TRIGGER profiles_no_role_self_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();


-- ============================================================================
-- SEC-04: Fix organization_members INSERT
-- Uses SECURITY DEFINER helpers to avoid recursive RLS.
-- ============================================================================
DROP POLICY IF EXISTS "org_members_insert" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_insert_restricted" ON public.organization_members;
CREATE POLICY "org_members_insert_restricted"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Platform admins can always insert
    public.is_admin()
    -- Org owner/admin can add members (uses SECURITY DEFINER — no recursion)
    OR public.is_org_owner_or_admin(organization_id)
    -- Self-insert allowed ONLY during org bootstrap (no members exist yet)
    OR (
      profile_id = auth.uid()
      AND NOT public.org_has_members(organization_id)
    )
  );


-- ============================================================================
-- RBAC-03: Fix organization_members UPDATE
-- Uses SECURITY DEFINER helper to avoid recursive RLS.
-- ============================================================================
DROP POLICY IF EXISTS "org_members_update" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_update_restricted" ON public.organization_members;
CREATE POLICY "org_members_update_restricted"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (
    public.is_org_owner_or_admin(organization_id)
    OR public.is_admin()
  );


-- ============================================================================
-- RBAC-04: Fix organization_members DELETE
-- Uses SECURITY DEFINER helper to avoid recursive RLS.
-- ============================================================================
DROP POLICY IF EXISTS "org_members_delete" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_delete_restricted" ON public.organization_members;
CREATE POLICY "org_members_delete_restricted"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (
    public.is_org_owner_or_admin(organization_id)
    OR profile_id = auth.uid()
    OR public.is_admin()
  );


-- ============================================================================
-- SEC-05: Fix organizations INSERT
-- ============================================================================
DROP POLICY IF EXISTS "orgs_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "orgs_insert_role_restricted" ON public.organizations;
CREATE POLICY "orgs_insert_role_restricted"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('organization', 'admin')
    AND (owner_id = auth.uid() OR public.is_admin())
  );


-- ============================================================================
-- SEC-06: Fix conversations INSERT
-- ============================================================================
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_self" ON public.conversations;
CREATE POLICY "conversations_insert_self"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND member_id = auth.uid()
  );


-- ============================================================================
-- Fix service_requests UPDATE
-- ============================================================================
DROP POLICY IF EXISTS "requests_update" ON public.service_requests;
DROP POLICY IF EXISTS "requests_update_role_checked" ON public.service_requests;
CREATE POLICY "requests_update_role_checked"
  ON public.service_requests FOR UPDATE
  TO authenticated
  USING (
    (
      assigned_org_id IN (SELECT * FROM public.get_my_org_ids())
      AND get_user_role() IN ('organization', 'admin')
    )
    OR public.is_admin()
  );


-- ============================================================================
-- Grant necessary permissions for the new helper functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.is_org_owner_or_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_members(UUID) TO authenticated;
