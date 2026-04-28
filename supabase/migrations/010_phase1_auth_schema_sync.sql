-- Phase 1 schema sync and safer auth signup flow
-- Prevents "Database error saving new user" caused by invalid role casts

-- Normalize arbitrary metadata role text into valid enum values.
CREATE OR REPLACE FUNCTION public.normalize_user_role(role_text TEXT)
RETURNS user_role AS $$
BEGIN
  RETURN CASE
    WHEN role_text = 'community_member' THEN 'community_member'::user_role
    WHEN role_text = 'organization' THEN 'organization'::user_role
    WHEN role_text = 'admin' THEN 'admin'::user_role
    ELSE 'community_member'::user_role
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Replace signup trigger function with a safe version.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  normalized_role user_role;
BEGIN
  normalized_role := public.normalize_user_role(NEW.raw_user_meta_data->>'role');

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    normalized_role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = EXCLUDED.role;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger idempotently.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure commonly updated profile fields exist for Phase 1 profile editing.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS borough TEXT;

-- Helpful index for profile lookups used by auth context.
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);
