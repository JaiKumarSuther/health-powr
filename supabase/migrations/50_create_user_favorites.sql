-- Create user_favorites table
create table if not exists user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  service_id uuid references services(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, service_id)
);

-- Enable RLS
alter table user_favorites enable row level security;

-- Policy: users can only read/write their own favorites
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'user_favorites' and policyname = 'Users manage own favorites'
  ) then
    create policy "Users manage own favorites"
    on user_favorites for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$$;

-- Indexes for performance
create index if not exists user_favorites_user_id_idx on user_favorites(user_id);
create index if not exists user_favorites_service_id_idx on user_favorites(service_id);
