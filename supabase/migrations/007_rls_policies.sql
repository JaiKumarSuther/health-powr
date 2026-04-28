-- Enable RLS on all tables
ALTER TABLE public.profiles 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_status_history 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_notes 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads 
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comments 
  ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles 
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get user's org id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id 
  FROM public.organization_members
  WHERE profile_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles Policies
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_select_for_orgs"
  ON public.profiles FOR SELECT
  USING (get_user_role() IN ('organization', 'admin'));

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Organizations Policies
CREATE POLICY "orgs_select_approved"
  ON public.organizations FOR SELECT
  USING (
    status = 'approved' 
    OR owner_id = auth.uid()
    OR get_user_role() = 'admin'
  );

CREATE POLICY "orgs_update_own"
  ON public.organizations FOR UPDATE
  USING (
    owner_id = auth.uid() 
    OR get_user_role() = 'admin'
  );

CREATE POLICY "orgs_insert_authenticated"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "orgs_delete_admin"
  ON public.organizations FOR DELETE
  USING (get_user_role() = 'admin');

-- Services Policies
CREATE POLICY "services_select_active"
  ON public.services FOR SELECT
  USING (
    is_available = true 
    OR organization_id = get_user_org_id()
    OR get_user_role() = 'admin'
  );

CREATE POLICY "services_manage_own_org"
  ON public.services FOR ALL
  USING (
    organization_id = get_user_org_id()
    OR get_user_role() = 'admin'
  );

-- Service Requests Policies
CREATE POLICY "requests_select_member"
  ON public.service_requests FOR SELECT
  USING (
    member_id = auth.uid()
    OR assigned_org_id = get_user_org_id()
    OR get_user_role() = 'admin'
  );

CREATE POLICY "requests_insert_member"
  ON public.service_requests FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND member_id = auth.uid()
  );

CREATE POLICY "requests_update"
  ON public.service_requests FOR UPDATE
  USING (
    assigned_org_id = get_user_org_id()
    OR get_user_role() = 'admin'
  );

-- Messages Policies
CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT
  USING (
    member_id = auth.uid()
    OR organization_id = get_user_org_id()
    OR get_user_role() = 'admin'
  );

CREATE POLICY "conversations_insert"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "messages_select"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (
        c.member_id = auth.uid()
        OR c.organization_id = get_user_org_id()
        OR get_user_role() = 'admin'
      )
    )
  );

CREATE POLICY "messages_insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (
        c.member_id = auth.uid()
        OR c.organization_id = get_user_org_id()
      )
    )
  );

-- Internal Notes Policies
CREATE POLICY "notes_select_org"
  ON public.request_notes FOR SELECT
  USING (
    get_user_role() IN ('organization', 'admin')
    OR (
      is_internal = false 
      AND EXISTS (
        SELECT 1 FROM public.service_requests r
        WHERE r.id = request_id
        AND r.member_id = auth.uid()
      )
    )
  );

CREATE POLICY "notes_insert_org"
  ON public.request_notes FOR INSERT
  WITH CHECK (
    get_user_role() IN ('organization', 'admin')
    AND author_id = auth.uid()
  );

-- Forum Policies
CREATE POLICY "threads_select"
  ON public.forum_threads FOR SELECT
  USING (
    is_moderated = false
    OR get_user_role() = 'admin'
  );

CREATE POLICY "threads_insert"
  ON public.forum_threads FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
  );

CREATE POLICY "threads_update"
  ON public.forum_threads FOR UPDATE
  USING (
    author_id = auth.uid()
    OR get_user_role() = 'admin'
  );

CREATE POLICY "comments_select"
  ON public.forum_comments FOR SELECT
  USING (
    is_moderated = false
    OR get_user_role() = 'admin'
  );

CREATE POLICY "comments_insert"
  ON public.forum_comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
  );

CREATE POLICY "comments_update"
  ON public.forum_comments FOR UPDATE
  USING (
    author_id = auth.uid()
    OR get_user_role() = 'admin'
  );

-- Status History Policies
CREATE POLICY "status_history_select"
  ON public.request_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests r
      WHERE r.id = request_id
      AND (
        r.member_id = auth.uid()
        OR r.assigned_org_id = get_user_org_id()
        OR get_user_role() = 'admin'
      )
    )
  );

CREATE POLICY "status_history_insert"
  ON public.request_status_history FOR INSERT
  WITH CHECK (
    changed_by = auth.uid()
    AND get_user_role() IN ('organization', 'admin')
  );
