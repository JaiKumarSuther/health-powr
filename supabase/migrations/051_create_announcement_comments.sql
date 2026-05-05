-- Create announcement_comments table
create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid references public.org_announcements(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.announcement_comments enable row level security;

-- Recreate policies safely
drop policy if exists "Comments are viewable by everyone"
on public.announcement_comments;

drop policy if exists "Users manage own announcement comments"
on public.announcement_comments;

create policy "Comments are viewable by everyone"
on public.announcement_comments
for select
using (true);

create policy "Users manage own announcement comments"
on public.announcement_comments
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Indexes
create index if not exists announcement_comments_announcement_id_idx
on public.announcement_comments(announcement_id);

create index if not exists announcement_comments_user_id_idx
on public.announcement_comments(user_id);