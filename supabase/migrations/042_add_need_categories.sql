ALTER TABLE public.service_requests
ADD COLUMN IF NOT EXISTS need_categories text[] DEFAULT '{}';

