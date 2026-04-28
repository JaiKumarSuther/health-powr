-- Fix admin/org role resolution for RLS
-- Current RLS policies rely on public.get_user_role().
-- If an existing user has an out-of-date or missing public.profiles row,
-- the old get_user_role() (profiles-only) can cause unexpected 403s.
-- This version falls back to auth.users/raw_user_meta_data (and JWT claims)
-- and normalizes it into the user_role enum.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
    public.normalize_user_role(
      COALESCE(
        (SELECT u.raw_user_meta_data->>'role' FROM auth.users u WHERE u.id = auth.uid()),
        auth.jwt() -> 'user_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata' ->> 'role',
        'community_member'
      )
    )
  );
$$;

