-- Conversations SELECT
DROP POLICY IF EXISTS "conversations_select_v4" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_v5" ON public.conversations;

CREATE POLICY "conversations_select_v5"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    member_id = auth.uid()

    OR public.is_admin()

    OR (
      conversation_type = 'request'
      AND assigned_staff_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
          AND om.organization_id = conversations.organization_id
          AND om.role IN ('member', 'admin')
      )
    )

    OR public.is_conversation_participant(id)
  );

-- Messages SELECT
DROP POLICY IF EXISTS "messages_select_v4" ON public.messages;
DROP POLICY IF EXISTS "messages_select_v5" ON public.messages;

CREATE POLICY "messages_select_v5"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.member_id = auth.uid()
          OR public.is_admin()
          OR (
            c.conversation_type = 'request'
            AND c.assigned_staff_id = auth.uid()
            AND EXISTS (
              SELECT 1
              FROM public.organization_members om
              WHERE om.profile_id = auth.uid()
                AND om.organization_id = c.organization_id
                AND om.role IN ('member', 'admin')
            )
          )
          OR public.is_conversation_participant(c.id)
        )
    )
  );

-- Messages INSERT
DROP POLICY IF EXISTS "messages_insert_v4" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_v5" ON public.messages;

CREATE POLICY "messages_insert_v5"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.member_id = auth.uid()
          OR (
            c.conversation_type = 'request'
            AND c.assigned_staff_id = auth.uid()
            AND EXISTS (
              SELECT 1
              FROM public.organization_members om
              WHERE om.profile_id = auth.uid()
                AND om.organization_id = c.organization_id
                AND om.role IN ('member', 'admin')
            )
          )
          OR public.is_conversation_participant(c.id)
        )
    )
  );