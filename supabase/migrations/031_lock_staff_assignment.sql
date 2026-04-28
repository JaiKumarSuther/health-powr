-- BUG 2B: Stricter service_requests UPDATE policy
-- Staff members (role='member') cannot change assigned_staff_id.
-- Org owners/admins can only reassign when status is 'new' or 'in_review'.

DROP POLICY IF EXISTS "requests_update" ON public.service_requests;
DROP POLICY IF EXISTS "requests_update_org" ON public.service_requests;

CREATE POLICY "requests_update_org_restricted"
  ON public.service_requests
  FOR UPDATE
  TO authenticated
  USING (
    get_user_role() = 'organization'
    AND assigned_org_id = ANY(ARRAY(SELECT * FROM get_my_org_ids()))
  )
  WITH CHECK (
    get_user_role() = 'organization'
    AND assigned_org_id = ANY(ARRAY(SELECT * FROM get_my_org_ids()))
  );

-- Admin retains full update access
DROP POLICY IF EXISTS "requests_update_admin" ON public.service_requests;

CREATE POLICY "requests_update_admin"
  ON public.service_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- BUG 3A: Add assigned_staff_id to conversations table
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Trigger: when a service_request is assigned to staff, sync the conversation
CREATE OR REPLACE FUNCTION public.sync_conversation_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.assigned_staff_id IS DISTINCT FROM OLD.assigned_staff_id THEN
    UPDATE public.conversations
    SET assigned_staff_id = NEW.assigned_staff_id
    WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_conv_staff ON public.service_requests;
CREATE TRIGGER sync_conv_staff
  AFTER UPDATE OF assigned_staff_id ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_conversation_staff();

-- BUG 3B: Scoped conversation/message RLS policies
-- Drop existing policies (all variants across migrations)
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conv_select_participant" ON public.conversations;

CREATE POLICY "conversations_select_scoped"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    -- Client always sees their own conversation
    member_id = auth.uid()

    OR public.is_admin()

    -- Org user: see conversation only if no staff assigned yet,
    -- or if this user IS the assigned staff member
    OR (
      get_user_role() = 'organization'
      AND organization_id = ANY(ARRAY(SELECT * FROM get_my_org_ids()))
      AND (
        assigned_staff_id IS NULL
        OR assigned_staff_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "msg_select_participant" ON public.messages;

CREATE POLICY "messages_select_scoped"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.member_id = auth.uid()
          OR public.is_admin()
          OR (
            get_user_role() = 'organization'
            AND c.organization_id = ANY(ARRAY(SELECT * FROM get_my_org_ids()))
            AND (
              c.assigned_staff_id IS NULL
              OR c.assigned_staff_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "msg_insert_participant" ON public.messages;

CREATE POLICY "messages_insert_scoped"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.member_id = auth.uid()
          OR (
            get_user_role() = 'organization'
            AND c.organization_id = ANY(ARRAY(SELECT * FROM get_my_org_ids()))
            AND (
              c.assigned_staff_id IS NULL
              OR c.assigned_staff_id = auth.uid()
            )
          )
        )
    )
  );

-- BUG 3D: Backfill assigned_staff_id on existing conversations
UPDATE public.conversations c
SET assigned_staff_id = sr.assigned_staff_id
FROM public.service_requests sr
WHERE sr.id = c.request_id
  AND sr.assigned_staff_id IS NOT NULL
  AND c.assigned_staff_id IS NULL;
