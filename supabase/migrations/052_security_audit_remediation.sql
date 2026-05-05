-- ============================================================================
-- Migration 052: Security Audit Remediation
-- Fixes:
-- H-3: Insecure is_admin()
-- H-7: Conversation race condition
-- M-9: Atomic conversation creation
-- ============================================================================

-- ============================================================================
-- 1. Secure role helper functions
-- Do NOT read user_metadata because it is client-writable.
-- Prefer profiles.role, then app_metadata.role, then fallback.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT (
    COALESCE(
      (
        SELECT p.role::text
        FROM public.profiles p
        WHERE p.id = auth.uid()
        LIMIT 1
      ),
      auth.jwt() -> 'app_metadata' ->> 'role',
      'community_member'
    ) = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organization()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT (
    COALESCE(
      (
        SELECT p.role::text
        FROM public.profiles p
        WHERE p.id = auth.uid()
        LIMIT 1
      ),
      auth.jwt() -> 'app_metadata' ->> 'role',
      'community_member'
    ) IN ('organization', 'owner')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization() TO authenticated;

-- ============================================================================
-- 2. Ensure each profile can only appear once per conversation
-- Prevents duplicate participant records.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversation_participants_conversation_profile_unique'
  ) THEN
    ALTER TABLE public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_profile_unique
    UNIQUE (conversation_id, profile_id);
  END IF;
END $$;

-- ============================================================================
-- 3. Atomic direct conversation creation
-- Uses advisory transaction lock to prevent two concurrent requests from
-- creating duplicate direct conversations for the same pair in the same org.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(
  target_org_id uuid,
  other_profile_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  existing_conv_id uuid;
  new_conv_id uuid;
  caller_id uuid := auth.uid();
  user_a uuid;
  user_b uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'target_org_id is required';
  END IF;

  IF other_profile_id IS NULL THEN
    RAISE EXCEPTION 'other_profile_id is required';
  END IF;

  IF caller_id = other_profile_id THEN
    RAISE EXCEPTION 'Cannot create a direct conversation with yourself';
  END IF;

  -- Normalize participant order so the lock key is stable.
  IF caller_id::text < other_profile_id::text THEN
    user_a := caller_id;
    user_b := other_profile_id;
  ELSE
    user_a := other_profile_id;
    user_b := caller_id;
  END IF;

  -- Transaction-scoped lock for this org + user pair.
  -- This prevents duplicate conversation creation under concurrency.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(target_org_id::text || ':' || user_a::text || ':' || user_b::text, 0)
  );

  -- Check again after acquiring the lock.
  SELECT c.id
  INTO existing_conv_id
  FROM public.conversations c
  JOIN public.conversation_participants p1
    ON p1.conversation_id = c.id
   AND p1.profile_id = caller_id
  JOIN public.conversation_participants p2
    ON p2.conversation_id = c.id
   AND p2.profile_id = other_profile_id
  WHERE c.organization_id = target_org_id
    AND c.conversation_type::text = 'direct'
  LIMIT 1;

  IF existing_conv_id IS NOT NULL THEN
    RETURN existing_conv_id;
  END IF;

  INSERT INTO public.conversations (
    organization_id,
    conversation_type,
    last_message_at
  )
  VALUES (
    target_org_id,
    'direct',
    now()
  )
  RETURNING id INTO new_conv_id;

  INSERT INTO public.conversation_participants (
    conversation_id,
    profile_id
  )
  VALUES
    (new_conv_id, caller_id),
    (new_conv_id, other_profile_id)
  ON CONFLICT DO NOTHING;

  RETURN new_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid, uuid) TO authenticated;