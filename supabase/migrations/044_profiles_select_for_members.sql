-- Allow community members to read limited profile rows needed for messaging.
-- Without this, joins like service_requests.assigned_staff -> profiles return null due to RLS.

-- 1) Always allow a user to read their own profile
create policy "profiles_select_self"
on public.profiles
as permissive
for select
to authenticated
using (id = auth.uid());

-- 2) Allow a member to read the assigned staff member's profile for their own requests
create policy "profiles_select_assigned_staff_for_member_requests"
on public.profiles
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.service_requests r
    where r.member_id = auth.uid()
      and r.assigned_staff_id = profiles.id
  )
);

