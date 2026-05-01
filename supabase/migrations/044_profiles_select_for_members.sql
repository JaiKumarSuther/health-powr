-- Allow community members to read limited profile rows needed for messaging.
-- Without this, joins like service_requests.assigned_staff -> profiles return null due to RLS.

-- 1) Always allow a user to read their own profile
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;

CREATE POLICY "profiles_select_self"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 2) Allow a member to read the assigned staff member's profile for their own requests
DROP POLICY IF EXISTS "profiles_select_assigned_staff_for_member_requests"
ON public.profiles;

CREATE POLICY "profiles_select_assigned_staff_for_member_requests"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.service_requests r
    WHERE r.member_id = auth.uid()
      AND r.assigned_staff_id = profiles.id
  )
);