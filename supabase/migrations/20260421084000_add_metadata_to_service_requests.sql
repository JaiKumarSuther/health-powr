ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- If you already ran the previous migration that added individual columns, also drop them:
ALTER TABLE service_requests
  DROP COLUMN IF EXISTS urgency,
  DROP COLUMN IF EXISTS household_size,
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS note;

