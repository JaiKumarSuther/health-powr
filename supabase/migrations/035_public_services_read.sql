-- Allow public read access to services
CREATE POLICY "Public can view available services"
  ON services
  FOR SELECT
  USING (true);

-- Allow public read access to organizations
-- Only show approved and active organizations to the public
CREATE POLICY "Public can view approved organizations"
  ON organizations
  FOR SELECT
  USING (status = 'approved');
