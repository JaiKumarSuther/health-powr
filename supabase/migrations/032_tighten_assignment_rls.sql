-- Recreate requests UPDATE policies cleanly after 031.
-- Status-based lock is enforced at the API layer (requestsApi.assignToStaff).
-- This migration documents intent and ensures the policy is present and correct.

DROP POLICY IF EXISTS "requests_update_org_restricted" ON public.service_requests;
DROP POLICY IF EXISTS "requests_update_admin" ON public.service_requests;

CREATE POLICY "requests_update_org_restricted"
  ON public.service_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'organization'
    AND assigned_org_id = ANY(ARRAY(SELECT * FROM public.get_my_org_ids()))
  )
  WITH CHECK (
    public.get_user_role() = 'organization'
    AND assigned_org_id = ANY(ARRAY(SELECT * FROM public.get_my_org_ids()))
  );

CREATE POLICY "requests_update_admin"
  ON public.service_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
