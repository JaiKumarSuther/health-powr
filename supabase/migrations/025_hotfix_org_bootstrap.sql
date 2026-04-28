-- ============================================================================
-- HOTFIX: Run this in Supabase SQL Editor to fix the org bootstrap flow
-- This replaces the broken policies from migration 024 v1
-- ============================================================================

-- Helper: SECURITY DEFINER function to check org ownership (avoids recursive RLS)
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

-- Helper: check if org has any members (for bootstrap)
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

-- Fix INSERT policy (was causing recursive RLS → blocking bootstrap)
DROP POLICY IF EXISTS "org_members_insert_restricted" ON public.organization_members;
CREATE POLICY "org_members_insert_restricted"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_org_owner_or_admin(organization_id)
    OR (
      profile_id = auth.uid()
      AND NOT public.org_has_members(organization_id)
    )
  );

-- Fix UPDATE policy
DROP POLICY IF EXISTS "org_members_update_restricted" ON public.organization_members;
CREATE POLICY "org_members_update_restricted"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (
    public.is_org_owner_or_admin(organization_id)
    OR public.is_admin()
  );

-- Fix DELETE policy
DROP POLICY IF EXISTS "org_members_delete_restricted" ON public.organization_members;
CREATE POLICY "org_members_delete_restricted"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (
    public.is_org_owner_or_admin(organization_id)
    OR profile_id = auth.uid()
    OR public.is_admin()
  );

-- Grant permissions for new helpers
GRANT EXECUTE ON FUNCTION public.is_org_owner_or_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_members(UUID) TO authenticated;
