-- 1) Normalize role text safely
create or replace function public.normalize_user_role(role_text text)
returns public.user_role
language plpgsql
immutable
as $$
begin
  return case
    when role_text = 'community_member' then 'community_member'::public.user_role
    when role_text = 'organization'     then 'organization'::public.user_role
    when role_text = 'admin'            then 'admin'::public.user_role
    else 'community_member'::public.user_role
  end;
end;
$$;

-- 2) Safe signup trigger (never blocks auth signup)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_role public.user_role;
begin
  normalized_role := public.normalize_user_role(new.raw_user_meta_data->>'role');

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    normalized_role
  )
  on conflict (id) do update
  set
    email     = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role      = excluded.role;

  return new;

exception when others then
  -- Don't block Supabase Auth signup if profiles insert fails
  return new;
end;
$$;

-- 3) Ensure trigger is attached
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();