-- Fix: ensure request conversations are visible to assigned staff.
-- Some DBs had request conversations created without assigned_staff_id, but RLS requires it.
-- This migration updates the auto-conversation trigger to always set assigned_staff_id and backfills existing rows.

CREATE OR REPLACE FUNCTION public.auto_conversation_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create/sync a conversation when both side identifiers exist.
  IF NEW.assigned_staff_id IS NULL OR NEW.assigned_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversations (
    request_id,
    member_id,
    organization_id,
    assigned_staff_id,
    conversation_type,
    last_message_at
  )
  VALUES (
    NEW.id,
    NEW.member_id,
    NEW.assigned_org_id,
    NEW.assigned_staff_id,
    'request',
    NOW()
  )
  ON CONFLICT (request_id) DO UPDATE
    SET assigned_staff_id = EXCLUDED.assigned_staff_id,
        organization_id = EXCLUDED.organization_id,
        member_id = EXCLUDED.member_id,
        conversation_type = 'request'
  ;

  RETURN NEW;
END;
$$;

-- Backfill: ensure existing request conversations have assigned_staff_id.
UPDATE public.conversations c
SET assigned_staff_id = sr.assigned_staff_id,
    conversation_type = COALESCE(c.conversation_type, 'request')
FROM public.service_requests sr
WHERE c.request_id = sr.id
  AND sr.assigned_staff_id IS NOT NULL
  AND sr.assigned_org_id IS NOT NULL
  AND (c.assigned_staff_id IS NULL OR c.assigned_staff_id <> sr.assigned_staff_id);

-- Backfill: create missing conversations for already-assigned requests.
INSERT INTO public.conversations (request_id, member_id, organization_id, assigned_staff_id, conversation_type)
SELECT
  sr.id,
  sr.member_id,
  sr.assigned_org_id,
  sr.assigned_staff_id,
  'request'
FROM public.service_requests sr
LEFT JOIN public.conversations c
  ON c.request_id = sr.id
WHERE sr.assigned_staff_id IS NOT NULL
  AND sr.assigned_org_id IS NOT NULL
  AND c.id IS NULL
ON CONFLICT (request_id) DO NOTHING;