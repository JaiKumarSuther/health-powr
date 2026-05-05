-- ============================================================================
-- Create user_favorites table
-- ============================================================================

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Add unique constraint safely
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_favorites_user_id_service_id_unique'
  ) then
    alter table public.user_favorites
    add constraint user_favorites_user_id_service_id_unique
    unique (user_id, service_id);
  end if;
end $$;

-- Enable RLS
alter table public.user_favorites enable row level security;

-- Recreate policy safely
drop policy if exists "Users manage own favorites"
on public.user_favorites;

create policy "Users manage own favorites"
on public.user_favorites
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Indexes for performance
create index if not exists user_favorites_user_id_idx
on public.user_favorites(user_id);

create index if not exists user_favorites_service_id_idx
on public.user_favorites(service_id);