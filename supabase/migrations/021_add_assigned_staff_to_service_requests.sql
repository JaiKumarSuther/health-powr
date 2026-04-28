alter table public.service_requests
  add column if not exists assigned_staff_id uuid
    references public.profiles(id)
    on delete set null;

create index if not exists idx_service_requests_assigned_staff
  on public.service_requests(assigned_staff_id);
