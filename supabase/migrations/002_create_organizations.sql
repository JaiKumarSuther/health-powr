CREATE TYPE org_status AS ENUM (
  'pending',    -- awaiting admin approval
  'approved',   -- active on platform
  'rejected',   -- rejected by admin
  'suspended'   -- temporarily disabled
);

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) 
             ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT[], -- ['housing', 'food', 'healthcare', etc.]
  borough TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  status org_status DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  hours_of_operation JSONB, 
  -- { "mon": "9AM-5PM", "tue": "9AM-5PM", ... }
  eligibility_requirements TEXT,
  languages_supported TEXT[] DEFAULT ARRAY['en'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- A user can belong to an organization
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) 
                  ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) 
             ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, profile_id)
);

-- Services offered by organizations
CREATE TYPE service_category AS ENUM (
  'housing', 'food', 'healthcare', 
  'job_training', 'education', 'legal',
  'mental_health', 'childcare', 'other'
);

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) 
                  ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category service_category NOT NULL,
  borough TEXT,
  eligibility TEXT,
  hours TEXT,
  is_available BOOLEAN DEFAULT true,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_organizations_status 
  ON public.organizations(status);
CREATE INDEX idx_organizations_borough 
  ON public.organizations(borough);
CREATE INDEX idx_services_category 
  ON public.services(category);
CREATE INDEX idx_services_borough 
  ON public.services(borough);
CREATE INDEX idx_services_org 
  ON public.services(organization_id);
