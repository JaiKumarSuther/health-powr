-- Create announcement_comments table
create table if not exists announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid references org_announcements(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table announcement_comments enable row level security;

-- Policy: users can view all comments, but only manage their own
create policy "Comments are viewable by everyone"
on announcement_comments for select
using (true);

create policy "Users manage own announcement comments"
on announcement_comments for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Indexes
create index if not exists announcement_comments_announcement_id_idx on announcement_comments(announcement_id);
