-- Remove ALL existing conversation and message SELECT/INSERT policies and replace
-- with a single definitive scoped set. Eliminates any risk of a broad policy
-- coexisting with the scoped one (permissive OR logic would let broad one win).

-- Conversations SELECT
DROP POLICY IF EXISTS "conversations_select"        ON public.conversations;
DROP POLICY IF EXISTS "conv_select_participant"     ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_scoped" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_org"    ON public.conversations;
DROP POLICY IF EXISTS "conversations_read"          ON public.conversations;

CREATE POLICY "conversations_select_v2"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    -- Client always sees their own conversation
    member_id = auth.uid()

    -- Platform admin sees all
    OR public.is_admin()

    -- Org user: see conversation only when no staff is assigned yet (open),
    -- or when this user IS the assigned staff member.
    OR (
      public.get_user_role() = 'organization'
      AND organization_id = ANY(ARRAY(SELECT * FROM public.get_my_org_ids()))
      AND (
        assigned_staff_id IS NULL
        OR assigned_staff_id = auth.uid()
      )
    )
  );

-- Messages SELECT
DROP POLICY IF EXISTS "messages_select"        ON public.messages;
DROP POLICY IF EXISTS "msg_select_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_select_scoped" ON public.messages;
DROP POLICY IF EXISTS "messages_read"          ON public.messages;

CREATE POLICY "messages_select_v2"
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
            public.get_user_role() = 'organization'
            AND c.organization_id = ANY(ARRAY(SELECT * FROM public.get_my_org_ids()))
            AND (
              c.assigned_staff_id IS NULL
              OR c.assigned_staff_id = auth.uid()
            )
          )
        )
    )
  );

-- Messages INSERT
DROP POLICY IF EXISTS "messages_insert"        ON public.messages;
DROP POLICY IF EXISTS "msg_insert_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_scoped" ON public.messages;

CREATE POLICY "messages_insert_v2"
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
            public.get_user_role() = 'organization'
            AND c.organization_id = ANY(ARRAY(SELECT * FROM public.get_my_org_ids()))
            AND (
              c.assigned_staff_id IS NULL
              OR c.assigned_staff_id = auth.uid()
            )
          )
        )
    )
  );

-- Backfill: sync assigned_staff_id from service_requests to conversations
-- for any rows where the request has a staff assignment but the conversation doesn't.
UPDATE public.conversations c
SET assigned_staff_id = sr.assigned_staff_id
FROM public.service_requests sr
WHERE sr.id = c.request_id
  AND sr.assigned_staff_id IS NOT NULL
  AND c.assigned_staff_id IS NULL;
