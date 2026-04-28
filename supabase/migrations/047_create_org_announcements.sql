-- Community announcements (platform + CBO posts)
-- Creates:
-- - public.org_announcements
-- - public.announcement_reactions
-- - storage bucket: community
-- and enables RLS policies for admin/org posting + member reactions.

create table if not exists public.org_announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  title text not null,
  body text not null,
  category text not null default 'Announcement',
  borough text,
  event_date date,
  image_url text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger org_announcements_updated_at
  before update on public.org_announcements
  for each row execute function update_updated_at();

create index if not exists idx_org_announcements_created_at
  on public.org_announcements (created_at desc);

create index if not exists idx_org_announcements_pinned_created_at
  on public.org_announcements (is_pinned desc, created_at desc);

create index if not exists idx_org_announcements_org_id
  on public.org_announcements (org_id);

-- Reactions (like/save)
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'announcement_reaction_type'
      and n.nspname = 'public'
  ) then
    create type public.announcement_reaction_type as enum ('like', 'save');
  end if;
end
$$;

create table if not exists public.announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.org_announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.announcement_reaction_type not null,
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id, type)
);

create index if not exists idx_announcement_reactions_announcement_id
  on public.announcement_reactions (announcement_id);

create index if not exists idx_announcement_reactions_user_id
  on public.announcement_reactions (user_id);

-- RLS
alter table public.org_announcements enable row level security;
alter table public.announcement_reactions enable row level security;

-- Read: any authenticated user can read announcements and reactions
drop policy if exists "announcements_select_authenticated" on public.org_announcements;
create policy "announcements_select_authenticated"
  on public.org_announcements
  for select
  to authenticated
  using (true);

drop policy if exists "announcement_reactions_select_authenticated" on public.announcement_reactions;
create policy "announcement_reactions_select_authenticated"
  on public.announcement_reactions
  for select
  to authenticated
  using (true);

-- Admin can manage all announcements (platform + CBO)
drop policy if exists "announcements_admin_all" on public.org_announcements;
create policy "announcements_admin_all"
  on public.org_announcements
  for all
  to authenticated
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- Organization owners/admins can manage their org's announcements
drop policy if exists "announcements_org_manage_own" on public.org_announcements;
create policy "announcements_org_manage_own"
  on public.org_announcements
  for all
  to authenticated
  using (
    public.get_user_role() = 'organization'
    and org_id is not null
    and exists (
      select 1
      from public.organization_members om
      where om.profile_id = auth.uid()
        and om.organization_id = org_announcements.org_id
        and om.role in ('owner', 'admin')
    )
  )
  with check (
    public.get_user_role() = 'organization'
    and org_id is not null
    and exists (
      select 1
      from public.organization_members om
      where om.profile_id = auth.uid()
        and om.organization_id = org_announcements.org_id
        and om.role in ('owner', 'admin')
    )
  );

-- Reactions: members can manage their own reactions
drop policy if exists "announcement_reactions_insert_own" on public.announcement_reactions;
create policy "announcement_reactions_insert_own"
  on public.announcement_reactions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "announcement_reactions_delete_own" on public.announcement_reactions;
create policy "announcement_reactions_delete_own"
  on public.announcement_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Storage bucket for announcement images
insert into storage.buckets (id, name, public)
values ('community', 'community', true)
on conflict (id) do update set public = true;

-- storage.objects policies (bucket: community)
-- Public read
drop policy if exists "community_bucket_public_read" on storage.objects;
create policy "community_bucket_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'community');

-- Only admin / organization can upload/manage community assets
drop policy if exists "community_bucket_admin_org_insert" on storage.objects;
create policy "community_bucket_admin_org_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'community'
    and public.get_user_role() in ('admin', 'organization')
  );

drop policy if exists "community_bucket_admin_org_update" on storage.objects;
create policy "community_bucket_admin_org_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'community'
    and public.get_user_role() in ('admin', 'organization')
  )
  with check (
    bucket_id = 'community'
    and public.get_user_role() in ('admin', 'organization')
  );

drop policy if exists "community_bucket_admin_org_delete" on storage.objects;
create policy "community_bucket_admin_org_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'community'
    and public.get_user_role() in ('admin', 'organization')
  );

