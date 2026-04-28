alter table public.organization_members
  add column if not exists username text;

create unique index if not exists idx_org_members_username_unique
  on public.organization_members (organization_id, lower(username))
  where username is not null;