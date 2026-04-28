-- Core of Phase 1: the request loop

CREATE TYPE request_status AS ENUM (
  'new',          -- just submitted
  'in_review',    -- org reviewing it
  'in_progress',  -- actively being handled
  'closed'        -- resolved or closed
);

CREATE TYPE request_priority AS ENUM (
  'low', 'medium', 'high'
);

CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who submitted it
  member_id UUID NOT NULL 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE,
  
  -- What they're requesting
  category service_category NOT NULL,
  borough TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Assignment
  assigned_org_id UUID 
    REFERENCES public.organizations(id) 
    ON DELETE SET NULL,
  assigned_by UUID  -- admin who assigned it
    REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,
  
  -- Status tracking
  status request_status DEFAULT 'new',
  priority request_priority DEFAULT 'medium',
  
  -- Outcome
  outcome TEXT,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER service_requests_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Status history for tracking changes over time
CREATE TABLE public.request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL
    REFERENCES public.service_requests(id) 
    ON DELETE CASCADE,
  changed_by UUID NOT NULL
    REFERENCES public.profiles(id),
  old_status request_status,
  new_status request_status NOT NULL,
  note TEXT, -- optional note when changing status
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_requests_member 
  ON public.service_requests(member_id);
CREATE INDEX idx_requests_org 
  ON public.service_requests(assigned_org_id);
CREATE INDEX idx_requests_status 
  ON public.service_requests(status);
CREATE INDEX idx_requests_category 
  ON public.service_requests(category);
CREATE INDEX idx_requests_borough 
  ON public.service_requests(borough);
CREATE INDEX idx_status_history_request 
  ON public.request_status_history(request_id);
