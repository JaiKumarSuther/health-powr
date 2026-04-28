-- Internal notes added by org staff
-- NOT visible to community members

CREATE TABLE public.request_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL
    REFERENCES public.service_requests(id) 
    ON DELETE CASCADE,
  author_id UUID NOT NULL
    REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true, 
  -- true = org only, false = visible to member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.request_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_notes_request 
  ON public.request_notes(request_id);
