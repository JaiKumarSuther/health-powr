-- Add last_message_at for deterministic conversation ordering

alter table public.conversations
  add column if not exists last_message_at timestamptz;

-- Backfill from existing messages
update public.conversations c
set last_message_at = sub.max_created_at
from (
  select conversation_id, max(created_at) as max_created_at
  from public.messages
  group by conversation_id
) sub
where sub.conversation_id = c.id
  and c.last_message_at is null;

-- Default for new rows (best-effort)
alter table public.conversations
  alter column last_message_at set default now();

create index if not exists conversations_last_message_at_idx
  on public.conversations (last_message_at desc);

create or replace function public.hp_set_conversation_last_message_at()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_hp_set_conversation_last_message_at on public.messages;

create trigger trg_hp_set_conversation_last_message_at
after insert on public.messages
for each row
execute function public.hp_set_conversation_last_message_at();

