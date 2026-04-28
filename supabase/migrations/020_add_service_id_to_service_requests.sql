-- Add service_id to service_requests so each request can be tied to a specific service.

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS service_id UUID
    REFERENCES public.services(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_requests_service_id
  ON public.service_requests(service_id);
