-- Migration 036: Fix signup metadata capture
-- Captures borough from metadata and syncs role to app_metadata for security

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_role public.user_role;
BEGIN
  -- 1. Normalize role
  normalized_role := public.normalize_user_role(NEW.raw_user_meta_data->>'role');

  -- 2. Insert into profiles with all available metadata
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    borough
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    normalized_role,
    NULLIF(NEW.raw_user_meta_data->>'borough', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email     = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role      = EXCLUDED.role,
    borough   = COALESCE(EXCLUDED.borough, public.profiles.borough);

  -- 3. Sync role to app_metadata (optional but recommended for RLS performance/JWT trust)
  -- This ensures auth.jwt() -> 'app_metadata' ->> 'role' is always accurate.
  UPDATE auth.users 
  SET app_metadata = 
    jsonb_set(COALESCE(app_metadata, '{}'::jsonb), '{role}', to_jsonb(normalized_role::text))
  WHERE id = NEW.id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never block the actual signup in auth.users
  RETURN NEW;
END;
$$;
