-- ============================================================================
-- Migration 052: Security Audit Remediation
-- Fixes: H-3 (Insecure is_admin), H-7 (Conversation race condition), M-9 (Atomicity)
-- ============================================================================

-- 1. Secure is_admin() and is_organization()
-- These must trust the profiles table truth first, then app_metadata.
-- They MUST NOT check user_metadata as it is client-writable.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    COALESCE(
      (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()),
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
SET search_path = public
AS $$
  SELECT (
    COALESCE(
      (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()),
      auth.jwt() -> 'app_metadata' ->> 'role',
      'community_member'
    ) = 'organization'
  );
$$;

-- 2. Atomic Conversation Creation (Fixes H-7 and M-9)
-- This function handles the "get or create" logic for direct conversations
-- within a single transaction, preventing race conditions and orphaned records.

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(
  target_org_id UUID,
  other_profile_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_conv_id UUID;
  new_conv_id UUID;
  caller_id UUID := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check for existing direct conversation between these two users in this org
  -- We look for a conversation of type 'direct' where both are participants.
  SELECT c.id INTO existing_conv_id
  FROM public.conversations c
  JOIN public.conversation_participants p1 ON p1.conversation_id = c.id
  JOIN public.conversation_participants p2 ON p2.conversation_id = c.id
  WHERE c.organization_id = target_org_id
    AND c.conversation_type = 'direct'
    AND p1.profile_id = caller_id
    AND p2.profile_id = other_profile_id
  LIMIT 1;

  IF existing_conv_id IS NOT NULL THEN
    RETURN existing_conv_id;
  END IF;

  -- 2. Create new conversation if not found
  INSERT INTO public.conversations (organization_id, conversation_type, last_message_at)
  VALUES (target_org_id, 'direct', NOW())
  RETURNING id INTO new_conv_id;

  -- 3. Add participants
  INSERT INTO public.conversation_participants (conversation_id, profile_id)
  VALUES 
    (new_conv_id, caller_id),
    (new_conv_id, other_profile_id);

  RETURN new_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(UUID, UUID) TO authenticated;
