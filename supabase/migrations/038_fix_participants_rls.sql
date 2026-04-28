-- Step 1: Drop the recursive policy
DROP POLICY IF EXISTS "participants_select" ON public.conversation_participants;

-- Step 2: Create a SECURITY DEFINER function that bypasses RLS
-- This breaks the recursion by querying the table without triggering policies
CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  conv_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = conv_id
      AND profile_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 3: Recreate the participants policy using the helper function
-- The function runs without RLS (SECURITY DEFINER) so no recursion
CREATE POLICY "participants_select"
  ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

-- Step 4: Also fix conversations_select_v3 to use the helper
-- (it also queries conversation_participants which could recurse)
DROP POLICY IF EXISTS "conversations_select_v3" ON public.conversations;

CREATE POLICY "conversations_select_v3"
  ON public.conversations
  FOR SELECT TO authenticated
  USING (
    member_id = auth.uid()
    OR public.is_admin()
    OR (
      public.get_user_role() = 'organization'
      AND organization_id = ANY(ARRAY(SELECT * FROM public.get_my_org_ids()))
      AND (assigned_staff_id IS NULL OR assigned_staff_id = auth.uid())
      AND conversation_type = 'request'
    )
    OR public.is_conversation_participant(id)
  );

-- Step 5: Fix messages_select_v3 the same way
DROP POLICY IF EXISTS "messages_select_v3" ON public.messages;

CREATE POLICY "messages_select_v3"
  ON public.messages
  FOR SELECT TO authenticated
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
            AND (c.assigned_staff_id IS NULL OR c.assigned_staff_id = auth.uid())
            AND c.conversation_type = 'request'
          )
          OR public.is_conversation_participant(c.id)
        )
    )
  );

-- Step 6: Fix messages_insert_v3 the same way
DROP POLICY IF EXISTS "messages_insert_v3" ON public.messages;

CREATE POLICY "messages_insert_v3"
  ON public.messages
  FOR INSERT TO authenticated
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
            AND (c.assigned_staff_id IS NULL OR c.assigned_staff_id = auth.uid())
            AND c.conversation_type = 'request'
          )
          OR public.is_conversation_participant(c.id)
        )
    )
  );