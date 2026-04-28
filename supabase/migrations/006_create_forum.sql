-- Phase 1: lightweight forum
-- Threads → Posts → Comments

CREATE TABLE public.forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL
    REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category service_category,
  borough TEXT,
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  is_moderated BOOLEAN DEFAULT false, -- hidden pending review
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL
    REFERENCES public.forum_threads(id) 
    ON DELETE CASCADE,
  author_id UUID NOT NULL
    REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  is_moderated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER forum_threads_updated_at
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER forum_comments_updated_at
  BEFORE UPDATE ON public.forum_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_threads_author 
  ON public.forum_threads(author_id);
CREATE INDEX idx_threads_category 
  ON public.forum_threads(category);
CREATE INDEX idx_threads_borough 
  ON public.forum_threads(borough);
CREATE INDEX idx_comments_thread 
  ON public.forum_comments(thread_id);
