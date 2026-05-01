-- Allow public read access to services
DROP POLICY IF EXISTS "Public can view available services" ON services;

CREATE POLICY "Public can view available services"
  ON services
  FOR SELECT
  USING (true);

-- Allow public read access to organizations
-- Only show approved and active organizations to the public
DROP POLICY IF EXISTS "Public can view approved organizations" ON organizations;

CREATE POLICY "Public can view approved organizations"
  ON organizations
  FOR SELECT
  USING (status = 'approved');