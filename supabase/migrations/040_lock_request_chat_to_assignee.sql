-- Lock request-scoped messaging to the assigned staff member (org-side).
-- Requirement:
-- - Client ↔ assigned_staff member
-- - CBO owner/admin should NOT chat with clients (only with staff via internal chats)

-- Conversations SELECT (request conversations)
DROP POLICY IF EXISTS "conversations_select_v3" ON public.conversations;

CREATE POLICY "conversations_select_v4"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    -- Client always sees their own request conversation
    member_id = auth.uid()

    -- Platform admin sees all
    OR public.is_admin()

    -- Org-side: ONLY the assigned staff member can see request conversations
    OR (
      public.get_user_role() = 'organization'
      AND conversation_type = 'request'
      AND assigned_staff_id = auth.uid()
    )

    -- Internal: direct/group chats use participant model
    OR public.is_conversation_participant(id)
  );

-- Messages SELECT
DROP POLICY IF EXISTS "messages_select_v3" ON public.messages;

CREATE POLICY "messages_select_v4"
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
            public.get_user_role() = 'organization'
            AND c.conversation_type = 'request'
            AND c.assigned_staff_id = auth.uid()
          )
          OR public.is_conversation_participant(c.id)
        )
    )
  );

-- Messages INSERT
DROP POLICY IF EXISTS "messages_insert_v3" ON public.messages;

CREATE POLICY "messages_insert_v4"
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
            public.get_user_role() = 'organization'
            AND c.conversation_type = 'request'
            AND c.assigned_staff_id = auth.uid()
          )
          OR public.is_conversation_participant(c.id)
        )
    )
  );

