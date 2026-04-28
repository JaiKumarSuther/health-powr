-- If public.profiles.role is stale, RLS helpers should prefer JWT metadata.
-- This prevents 403s when JWT says admin but profiles still shows organization.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    public.normalize_user_role(
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata' ->> 'role',
        (SELECT u.raw_user_meta_data->>'role' FROM auth.users u WHERE u.id = auth.uid()),
        (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()),
        'community_member'
      )
    ) = 'admin'::user_role
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
    public.normalize_user_role(
      COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata' ->> 'role',
        (SELECT u.raw_user_meta_data->>'role' FROM auth.users u WHERE u.id = auth.uid()),
        (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()),
        'community_member'
      )
    ) = 'organization'::user_role
  );
$$;

