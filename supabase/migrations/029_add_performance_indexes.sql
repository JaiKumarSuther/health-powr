-- 029_add_performance_indexes.sql
-- These columns are filtered on in nearly every query
CREATE INDEX IF NOT EXISTS idx_org_members_profile_id
  ON public.organization_members(profile_id);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id
  ON public.organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_service_requests_member_id
  ON public.service_requests(member_id);

CREATE INDEX IF NOT EXISTS idx_service_requests_assigned_org_id
  ON public.service_requests(assigned_org_id);

CREATE INDEX IF NOT EXISTS idx_service_requests_status
  ON public.service_requests(status);

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON public.profiles(email);

CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON public.organizations(status);

CREATE INDEX IF NOT EXISTS idx_services_org_id
  ON public.services(organization_id);

