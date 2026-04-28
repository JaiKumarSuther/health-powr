-- FIX-07: Scope request_notes SELECT to the org that owns the request
-- Bug: The original "notes_select_org" policy allowed ANY org role user to read
--      ALL request notes, regardless of whether the request belonged to their org.
-- Fix: Replace with two separate policies:
--   (1) Admin sees all notes.
--   (2) Org users only see notes for requests assigned to one of their orgs.
--   (3) Community members see non-internal notes on their own requests (unchanged).

DROP POLICY IF EXISTS "notes_select_org" ON public.request_notes;

-- Admins see all notes
CREATE POLICY "notes_select_admin"
  ON public.request_notes FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Org users see notes only for requests assigned to their org(s)
CREATE POLICY "notes_select_own_org"
  ON public.request_notes FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'organization'
    AND EXISTS (
      SELECT 1 FROM public.service_requests r
      WHERE r.id = request_id
        AND r.assigned_org_id = ANY(ARRAY(SELECT * FROM get_my_org_ids()))
    )
  );

-- Community members see non-internal notes on their own requests
CREATE POLICY "notes_select_member_public"
  ON public.request_notes FOR SELECT
  TO authenticated
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.service_requests r
      WHERE r.id = request_id
        AND r.member_id = auth.uid()
    )
  );

-- Also fix notes_insert_org to scope to the author's own org
DROP POLICY IF EXISTS "notes_insert_org" ON public.request_notes;

CREATE POLICY "notes_insert_org"
  ON public.request_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_admin()
      OR (
        get_user_role() = 'organization'
        AND EXISTS (
          SELECT 1 FROM public.service_requests r
          WHERE r.id = request_id
            AND r.assigned_org_id = ANY(ARRAY(SELECT * FROM get_my_org_ids()))
        )
      )
    )
  );


-- FIX-08: Add WITH CHECK to service_requests UPDATE policy
-- Bug: The original policy had a USING clause but no WITH CHECK, meaning a
--      malicious org user could UPDATE a request to change assigned_org_id
--      to a different org and still pass the policy check.
-- Fix: Add WITH CHECK mirroring USING so the post-update state is also validated.

DROP POLICY IF EXISTS "requests_update" ON public.service_requests;

CREATE POLICY "requests_update"
  ON public.service_requests FOR UPDATE
  USING (
    assigned_org_id = get_user_org_id()
    OR public.is_admin()
  )
  WITH CHECK (
    assigned_org_id = get_user_org_id()
    OR public.is_admin()
  );
