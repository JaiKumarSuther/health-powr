create table if not exists public.organization_staff_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  invite_token text not null unique,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_staff_invites_org_id
  on public.organization_staff_invites(organization_id);

create index if not exists idx_org_staff_invites_email
  on public.organization_staff_invites(lower(email));

create unique index if not exists idx_org_staff_invites_open_per_email
  on public.organization_staff_invites(organization_id, lower(email))
  where accepted_at is null;

alter table public.organization_staff_invites enable row level security;

drop policy if exists "Org admins can read staff invites" on public.organization_staff_invites;
create policy "Org admins can read staff invites"
  on public.organization_staff_invites
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_staff_invites.organization_id
        and om.profile_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
    or (
      accepted_at is null
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "Org admins can create staff invites" on public.organization_staff_invites;
create policy "Org admins can create staff invites"
  on public.organization_staff_invites
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_staff_invites.organization_id
        and om.profile_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
    and invited_by = auth.uid()
  );

drop policy if exists "Org admins can delete staff invites" on public.organization_staff_invites;
create policy "Org admins can delete staff invites"
  on public.organization_staff_invites
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_staff_invites.organization_id
        and om.profile_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

drop policy if exists "Invitees can accept their own invite" on public.organization_staff_invites;
create policy "Invitees can accept their own invite"
  on public.organization_staff_invites
  for update
  to authenticated
  using (
    accepted_at is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    accepted_at is not null
    and accepted_by = auth.uid()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
