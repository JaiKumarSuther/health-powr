-- Sample boroughs for NYC
CREATE TABLE public.boroughs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  city TEXT DEFAULT 'New York City'
);

INSERT INTO public.boroughs (name) VALUES
  ('Manhattan'),
  ('Brooklyn'),
  ('Queens'),
  ('Bronx'),
  ('Staten Island');

-- Service categories reference
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug service_category UNIQUE NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  color TEXT
);

INSERT INTO public.service_categories 
  (slug, label, icon, color) VALUES
  ('housing',      'Housing',       'home',        '#6366F1'),
  ('food',         'Food Access',   'utensils',    '#F97316'),
  ('healthcare',   'Healthcare',    'heart-pulse', '#0D9488'),
  ('job_training', 'Job Training',  'briefcase',   '#8B5CF6'),
  ('education',    'Education',     'book',        '#F59E0B'),
  ('legal',        'Legal Aid',     'scale',       '#EF4444'),
  ('mental_health','Mental Health', 'brain',       '#14B8A6'),
  ('childcare',    'Childcare',     'baby',        '#EC4899'),
  ('other',        'Other',         'circle-help', '#6B7280');
