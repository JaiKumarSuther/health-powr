-- Fix: org bootstrap failing with 403 on INSERT into public.organizations
-- Cause: org insert policy required get_user_role() to be 'organization' which can be
-- out-of-sync during first signup / restored DB states.
--
-- Security: still requires authenticated user and forces owner_id = auth.uid()
-- (or admin) so users cannot create orgs for other accounts.

DROP POLICY IF EXISTS "orgs_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "orgs_insert_role_restricted" ON public.organizations;

DROP POLICY IF EXISTS "orgs_insert_owner_or_admin" ON public.organizations;

CREATE POLICY "orgs_insert_owner_or_admin"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      owner_id = auth.uid()
      OR public.is_admin()
    )
  );

