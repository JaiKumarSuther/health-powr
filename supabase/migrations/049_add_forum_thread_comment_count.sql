-- Denormalized forum thread comment count for performance

alter table public.forum_threads
  add column if not exists comment_count integer not null default 0;

-- Backfill counts from existing comments (excluding moderated if desired)
update public.forum_threads t
set comment_count = sub.cnt
from (
  select thread_id, count(*)::int as cnt
  from public.forum_comments
  where coalesce(is_moderated, false) = false
  group by thread_id
) sub
where sub.thread_id = t.id;

create or replace function public.hp_forum_recount_thread_comments()
returns trigger
language plpgsql
security definer
as $$
declare
  tid uuid;
begin
  tid := coalesce(new.thread_id, old.thread_id);
  if tid is null then
    return coalesce(new, old);
  end if;

  update public.forum_threads
  set comment_count = (
    select count(*)::int
    from public.forum_comments c
    where c.thread_id = tid
      and coalesce(c.is_moderated, false) = false
  )
  where id = tid;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_hp_forum_recount_thread_comments_insert on public.forum_comments;
drop trigger if exists trg_hp_forum_recount_thread_comments_delete on public.forum_comments;
drop trigger if exists trg_hp_forum_recount_thread_comments_update on public.forum_comments;

create trigger trg_hp_forum_recount_thread_comments_insert
after insert on public.forum_comments
for each row execute function public.hp_forum_recount_thread_comments();

create trigger trg_hp_forum_recount_thread_comments_delete
after delete on public.forum_comments
for each row execute function public.hp_forum_recount_thread_comments();

create trigger trg_hp_forum_recount_thread_comments_update
after update of is_moderated on public.forum_comments
for each row execute function public.hp_forum_recount_thread_comments();

