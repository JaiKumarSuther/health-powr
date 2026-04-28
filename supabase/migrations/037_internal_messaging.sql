-- Internal messaging extensions:
-- - add conversation types (request/direct/group)
-- - add participant model for internal chats
-- - extend RLS to support internal chats
-- - auto-provision team chat + owner↔staff direct chat on staff add

-- Step 1: Add conversation_type to conversations table
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS conversation_type TEXT
    NOT NULL DEFAULT 'request'
    CHECK (conversation_type IN ('request', 'direct', 'group'));

-- Step 2: Make request_id optional (internal convos have no request)
ALTER TABLE public.conversations
  ALTER COLUMN request_id DROP NOT NULL;

-- Also make member_id optional (internal convos are org-only)
ALTER TABLE public.conversations
  ALTER COLUMN member_id DROP NOT NULL;

-- Step 3: Add display name for group chats
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Step 4: Conversation participants (for direct + group)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES public.conversations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(conversation_id, profile_id)
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS for conversation_participants
DROP POLICY IF EXISTS "participants_select" ON public.conversation_participants;
CREATE POLICY "participants_select"
  ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "participants_insert" ON public.conversation_participants;
CREATE POLICY "participants_insert"
  ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.profile_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Step 6: Update conversations RLS to include internal types
DROP POLICY IF EXISTS "conversations_select_v2" ON public.conversations;

DROP POLICY IF EXISTS "conversations_select_v3" ON public.conversations;
CREATE POLICY "conversations_select_v3"
  ON public.conversations
  FOR SELECT TO authenticated
  USING (
    -- existing request-scoped access
    member_id = auth.uid()
    OR public.is_admin()
    OR (
      public.get_user_role() = 'organization'
      AND organization_id = ANY(ARRAY(SELECT * FROM public.get_my_org_ids()))
      AND (assigned_staff_id IS NULL OR assigned_staff_id = auth.uid())
      AND conversation_type = 'request'
    )
    -- internal: participant in direct or group chat
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.profile_id = auth.uid()
    )
  );

-- Step 7: Update messages RLS for internal conversations
DROP POLICY IF EXISTS "messages_select_v2" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_v2" ON public.messages;

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
          OR EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = c.id
              AND cp.profile_id = auth.uid()
          )
        )
    )
  );

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
          OR EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = c.id
              AND cp.profile_id = auth.uid()
          )
        )
    )
  );

-- Step 8: messages UPDATE policy (mark as read)
DROP POLICY IF EXISTS "messages_update_read" ON public.messages;
CREATE POLICY "messages_update_read"
  ON public.messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.profile_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- Step 9: Auto-create org group chat + direct conversation
-- when a staff member is added to organization_members
CREATE OR REPLACE FUNCTION public.handle_new_staff_member()
RETURNS TRIGGER AS $$
DECLARE
  org_group_id UUID;
  owner_profile_id UUID;
  direct_id UUID;
BEGIN
  -- Find or create the org-wide group chat
  SELECT id INTO org_group_id
  FROM public.conversations
  WHERE organization_id = NEW.organization_id
    AND conversation_type = 'group'
  LIMIT 1;

  IF org_group_id IS NULL THEN
    -- Create the team group chat for this org
    INSERT INTO public.conversations (
      organization_id, conversation_type, title, last_message_at
    )
    VALUES (
      NEW.organization_id, 'group', 'Team Chat', NOW()
    )
    RETURNING id INTO org_group_id;

    -- Add the org owner to the group
    SELECT owner_id INTO owner_profile_id
    FROM public.organizations
    WHERE id = NEW.organization_id;

    IF owner_profile_id IS NOT NULL THEN
      INSERT INTO public.conversation_participants (conversation_id, profile_id)
      VALUES (org_group_id, owner_profile_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Add the new staff member to the group chat
  INSERT INTO public.conversation_participants (conversation_id, profile_id)
  VALUES (org_group_id, NEW.profile_id)
  ON CONFLICT DO NOTHING;

  -- Create a direct conversation between owner and new staff
  SELECT owner_id INTO owner_profile_id
  FROM public.organizations
  WHERE id = NEW.organization_id;

  IF owner_profile_id IS NOT NULL AND owner_profile_id <> NEW.profile_id THEN
    INSERT INTO public.conversations (
      organization_id, conversation_type, last_message_at
    )
    VALUES (NEW.organization_id, 'direct', NOW())
    RETURNING id INTO direct_id;

    INSERT INTO public.conversation_participants (conversation_id, profile_id)
    VALUES
      (direct_id, owner_profile_id),
      (direct_id, NEW.profile_id)
    ON CONFLICT DO NOTHING;

    -- Send a welcome message from the owner (or system proxy)
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (
      direct_id,
      owner_profile_id,
      'Welcome to the team! Feel free to message me here directly.'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_staff_member_added ON public.organization_members;
CREATE TRIGGER on_staff_member_added
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  WHEN (NEW.role IN ('admin', 'member'))
  EXECUTE FUNCTION public.handle_new_staff_member();

