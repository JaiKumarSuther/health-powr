-- Fix: ensure authenticated can select organizations
-- The admin UI queries service_requests with a join to organizations.
-- If SELECT privileges are missing, PostgREST returns 403/42501 even if RLS policies exist.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.organizations TO authenticated;

