-- Auto-create conversations when a service request is assigned to a staff member.
-- Ensures both client and staff portals can open the same chat thread.

CREATE OR REPLACE FUNCTION public.auto_conversation_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create a conversation when both side identifiers exist.
  IF NEW.assigned_staff_id IS NULL OR NEW.assigned_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversations (
    request_id,
    member_id,
    organization_id
  )
  VALUES (
    NEW.id,
    NEW.member_id,
    NEW.assigned_org_id
  )
  ON CONFLICT (request_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Insert-time trigger (for any requests inserted already assigned).
DROP TRIGGER IF EXISTS trg_auto_conversation_on_assignment_insert ON public.service_requests;
CREATE TRIGGER trg_auto_conversation_on_assignment_insert
  AFTER INSERT ON public.service_requests
  FOR EACH ROW
  WHEN (NEW.assigned_staff_id IS NOT NULL AND NEW.assigned_org_id IS NOT NULL)
  EXECUTE FUNCTION public.auto_conversation_on_assignment();

-- Update-time trigger (most common: assigned_staff_id is updated after creation).
DROP TRIGGER IF EXISTS trg_auto_conversation_on_assignment_update ON public.service_requests;
CREATE TRIGGER trg_auto_conversation_on_assignment_update
  AFTER UPDATE OF assigned_staff_id, assigned_org_id ON public.service_requests
  FOR EACH ROW
  WHEN (NEW.assigned_staff_id IS NOT NULL AND NEW.assigned_org_id IS NOT NULL)
  EXECUTE FUNCTION public.auto_conversation_on_assignment();

-- Backfill: create missing conversations for already-assigned requests.
INSERT INTO public.conversations (request_id, member_id, organization_id)
SELECT
  sr.id,
  sr.member_id,
  sr.assigned_org_id
FROM public.service_requests sr
WHERE sr.assigned_staff_id IS NOT NULL
  AND sr.assigned_org_id IS NOT NULL
ON CONFLICT (request_id) DO NOTHING;

