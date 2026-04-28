-- Step 1: Backfill group chats for all existing organizations
-- that have members but no group conversation yet

DO $$
DECLARE
  org RECORD;
  org_group_id UUID;
  member RECORD;
BEGIN
  -- Loop through every organization that has members
  FOR org IN
    SELECT DISTINCT organization_id
    FROM public.organization_members
  LOOP
    -- Check if a group chat already exists for this org
    SELECT id INTO org_group_id
    FROM public.conversations
    WHERE organization_id = org.organization_id
      AND conversation_type = 'group'
    LIMIT 1;

    -- Create group chat if missing
    IF org_group_id IS NULL THEN
      INSERT INTO public.conversations (
        organization_id,
        conversation_type,
        title,
        last_message_at
      )
      VALUES (
        org.organization_id,
        'group',
        'Team Chat',
        NOW()
      )
      RETURNING id INTO org_group_id;
    END IF;

    -- Add ALL current members of the org to the group chat
    FOR member IN
      SELECT profile_id
      FROM public.organization_members
      WHERE organization_id = org.organization_id
    LOOP
      INSERT INTO public.conversation_participants (
        conversation_id,
        profile_id
      )
      VALUES (org_group_id, member.profile_id)
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Also add the org owner
    INSERT INTO public.conversation_participants (
      conversation_id,
      profile_id
    )
    SELECT org_group_id, owner_id
    FROM public.organizations
    WHERE id = org.organization_id
      AND owner_id IS NOT NULL
    ON CONFLICT DO NOTHING;

  END LOOP;
END $$;

-- Step 2: Backfill direct conversations between
-- org owner and each staff member (where missing)

DO $$
DECLARE
  org RECORD;
  member RECORD;
  owner_id UUID;
  direct_id UUID;
  already_exists BOOLEAN;
BEGIN
  FOR org IN
    SELECT o.id AS org_id, o.owner_id AS owner_profile_id
    FROM public.organizations o
    WHERE o.owner_id IS NOT NULL
  LOOP
    owner_id := org.owner_profile_id;

    FOR member IN
      SELECT profile_id
      FROM public.organization_members
      WHERE organization_id = org.org_id
        AND profile_id != owner_id
        AND role IN ('admin', 'member')
    LOOP
      -- Check if a direct conversation already exists
      -- between this owner and this staff member
      SELECT EXISTS (
        SELECT 1
        FROM public.conversations c
        JOIN public.conversation_participants cp1
          ON cp1.conversation_id = c.id
          AND cp1.profile_id = owner_id
        JOIN public.conversation_participants cp2
          ON cp2.conversation_id = c.id
          AND cp2.profile_id = member.profile_id
        WHERE c.organization_id = org.org_id
          AND c.conversation_type = 'direct'
      ) INTO already_exists;

      IF NOT already_exists THEN
        -- Create the direct conversation
        INSERT INTO public.conversations (
          organization_id,
          conversation_type,
          last_message_at
        )
        VALUES (org.org_id, 'direct', NOW())
        RETURNING id INTO direct_id;

        -- Add both participants
        INSERT INTO public.conversation_participants (
          conversation_id, profile_id
        )
        VALUES
          (direct_id, owner_id),
          (direct_id, member.profile_id)
        ON CONFLICT DO NOTHING;

        -- Send a welcome message
        INSERT INTO public.messages (
          conversation_id, sender_id, content
        )
        VALUES (
          direct_id,
          owner_id,
          'Welcome to the team! Feel free to message me here directly.'
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;