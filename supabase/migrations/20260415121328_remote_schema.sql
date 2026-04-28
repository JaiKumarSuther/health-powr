drop extension if exists "pg_net";

drop trigger if exists "forum_comments_updated_at" on "public"."forum_comments";

drop trigger if exists "forum_threads_updated_at" on "public"."forum_threads";

drop trigger if exists "messages_update_conversation" on "public"."messages";

drop trigger if exists "organizations_updated_at" on "public"."organizations";

drop trigger if exists "profiles_no_role_self_change" on "public"."profiles";

drop trigger if exists "profiles_updated_at" on "public"."profiles";

drop trigger if exists "notes_updated_at" on "public"."request_notes";

drop trigger if exists "service_requests_updated_at" on "public"."service_requests";

drop trigger if exists "services_updated_at" on "public"."services";

drop policy "conversations_select" on "public"."conversations";

drop policy "comments_select" on "public"."forum_comments";

drop policy "comments_update" on "public"."forum_comments";

drop policy "threads_select" on "public"."forum_threads";

drop policy "threads_update" on "public"."forum_threads";

drop policy "messages_insert" on "public"."messages";

drop policy "messages_select" on "public"."messages";

drop policy "org_members_delete_restricted" on "public"."organization_members";

drop policy "org_members_insert_restricted" on "public"."organization_members";

drop policy "org_members_select_same_org" on "public"."organization_members";

drop policy "org_members_update_restricted" on "public"."organization_members";

drop policy "Org admins can create staff invites" on "public"."organization_staff_invites";

drop policy "Org admins can delete staff invites" on "public"."organization_staff_invites";

drop policy "Org admins can read staff invites" on "public"."organization_staff_invites";

drop policy "orgs_delete_admin" on "public"."organizations";

drop policy "orgs_insert_role_restricted" on "public"."organizations";

drop policy "orgs_select_approved" on "public"."organizations";

drop policy "orgs_update_own" on "public"."organizations";

drop policy "profiles_select_for_orgs" on "public"."profiles";

drop policy "notes_insert_org" on "public"."request_notes";

drop policy "notes_select_org" on "public"."request_notes";

drop policy "status_history_insert" on "public"."request_status_history";

drop policy "status_history_select" on "public"."request_status_history";

drop policy "requests_select_member" on "public"."service_requests";

drop policy "requests_update_role_checked" on "public"."service_requests";

drop policy "services_manage_own_org" on "public"."services";

drop policy "services_select_active" on "public"."services";

alter table "public"."conversations" drop constraint "conversations_member_id_fkey";

alter table "public"."conversations" drop constraint "conversations_organization_id_fkey";

alter table "public"."conversations" drop constraint "conversations_request_id_fkey";

alter table "public"."forum_comments" drop constraint "forum_comments_author_id_fkey";

alter table "public"."forum_comments" drop constraint "forum_comments_thread_id_fkey";

alter table "public"."forum_threads" drop constraint "forum_threads_author_id_fkey";

alter table "public"."messages" drop constraint "messages_conversation_id_fkey";

alter table "public"."messages" drop constraint "messages_sender_id_fkey";

alter table "public"."organization_members" drop constraint "organization_members_organization_id_fkey";

alter table "public"."organization_members" drop constraint "organization_members_profile_id_fkey";

alter table "public"."organization_staff_invites" drop constraint "organization_staff_invites_accepted_by_fkey";

alter table "public"."organization_staff_invites" drop constraint "organization_staff_invites_invited_by_fkey";

alter table "public"."organization_staff_invites" drop constraint "organization_staff_invites_organization_id_fkey";

alter table "public"."organizations" drop constraint "organizations_approved_by_fkey";

alter table "public"."organizations" drop constraint "organizations_owner_id_fkey";

alter table "public"."request_notes" drop constraint "request_notes_author_id_fkey";

alter table "public"."request_notes" drop constraint "request_notes_request_id_fkey";

alter table "public"."request_status_history" drop constraint "request_status_history_changed_by_fkey";

alter table "public"."request_status_history" drop constraint "request_status_history_request_id_fkey";

alter table "public"."service_requests" drop constraint "service_requests_assigned_by_fkey";

alter table "public"."service_requests" drop constraint "service_requests_assigned_org_id_fkey";

alter table "public"."service_requests" drop constraint "service_requests_assigned_staff_id_fkey";

alter table "public"."service_requests" drop constraint "service_requests_closed_by_fkey";

alter table "public"."service_requests" drop constraint "service_requests_member_id_fkey";

alter table "public"."service_requests" drop constraint "service_requests_service_id_fkey";

alter table "public"."services" drop constraint "services_organization_id_fkey";

alter table "public"."forum_threads" alter column "category" set data type public.service_category using "category"::text::public.service_category;

alter table "public"."organizations" alter column "status" set default 'pending'::public.org_status;

alter table "public"."organizations" alter column "status" set data type public.org_status using "status"::text::public.org_status;

alter table "public"."profiles" alter column "role" set default 'community_member'::public.user_role;

alter table "public"."profiles" alter column "role" set data type public.user_role using "role"::text::public.user_role;

alter table "public"."request_status_history" alter column "new_status" set data type public.request_status using "new_status"::text::public.request_status;

alter table "public"."request_status_history" alter column "old_status" set data type public.request_status using "old_status"::text::public.request_status;

alter table "public"."service_categories" alter column "slug" set data type public.service_category using "slug"::text::public.service_category;

alter table "public"."service_requests" alter column "category" set data type public.service_category using "category"::text::public.service_category;

alter table "public"."service_requests" alter column "priority" set default 'medium'::public.request_priority;

alter table "public"."service_requests" alter column "priority" set data type public.request_priority using "priority"::text::public.request_priority;

alter table "public"."service_requests" alter column "status" set default 'new'::public.request_status;

alter table "public"."service_requests" alter column "status" set data type public.request_status using "status"::text::public.request_status;

alter table "public"."services" alter column "category" set data type public.service_category using "category"::text::public.service_category;

alter table "public"."conversations" add constraint "conversations_member_id_fkey" FOREIGN KEY (member_id) REFERENCES public.profiles(id) not valid;

alter table "public"."conversations" validate constraint "conversations_member_id_fkey";

alter table "public"."conversations" add constraint "conversations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) not valid;

alter table "public"."conversations" validate constraint "conversations_organization_id_fkey";

alter table "public"."conversations" add constraint "conversations_request_id_fkey" FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE not valid;

alter table "public"."conversations" validate constraint "conversations_request_id_fkey";

alter table "public"."forum_comments" add constraint "forum_comments_author_id_fkey" FOREIGN KEY (author_id) REFERENCES public.profiles(id) not valid;

alter table "public"."forum_comments" validate constraint "forum_comments_author_id_fkey";

alter table "public"."forum_comments" add constraint "forum_comments_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES public.forum_threads(id) ON DELETE CASCADE not valid;

alter table "public"."forum_comments" validate constraint "forum_comments_thread_id_fkey";

alter table "public"."forum_threads" add constraint "forum_threads_author_id_fkey" FOREIGN KEY (author_id) REFERENCES public.profiles(id) not valid;

alter table "public"."forum_threads" validate constraint "forum_threads_author_id_fkey";

alter table "public"."messages" add constraint "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_conversation_id_fkey";

alter table "public"."messages" add constraint "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.profiles(id) not valid;

alter table "public"."messages" validate constraint "messages_sender_id_fkey";

alter table "public"."organization_members" add constraint "organization_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."organization_members" validate constraint "organization_members_organization_id_fkey";

alter table "public"."organization_members" add constraint "organization_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."organization_members" validate constraint "organization_members_profile_id_fkey";

alter table "public"."organization_staff_invites" add constraint "organization_staff_invites_accepted_by_fkey" FOREIGN KEY (accepted_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."organization_staff_invites" validate constraint "organization_staff_invites_accepted_by_fkey";

alter table "public"."organization_staff_invites" add constraint "organization_staff_invites_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."organization_staff_invites" validate constraint "organization_staff_invites_invited_by_fkey";

alter table "public"."organization_staff_invites" add constraint "organization_staff_invites_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."organization_staff_invites" validate constraint "organization_staff_invites_organization_id_fkey";

alter table "public"."organizations" add constraint "organizations_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES public.profiles(id) not valid;

alter table "public"."organizations" validate constraint "organizations_approved_by_fkey";

alter table "public"."organizations" add constraint "organizations_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."organizations" validate constraint "organizations_owner_id_fkey";

alter table "public"."request_notes" add constraint "request_notes_author_id_fkey" FOREIGN KEY (author_id) REFERENCES public.profiles(id) not valid;

alter table "public"."request_notes" validate constraint "request_notes_author_id_fkey";

alter table "public"."request_notes" add constraint "request_notes_request_id_fkey" FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE not valid;

alter table "public"."request_notes" validate constraint "request_notes_request_id_fkey";

alter table "public"."request_status_history" add constraint "request_status_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES public.profiles(id) not valid;

alter table "public"."request_status_history" validate constraint "request_status_history_changed_by_fkey";

alter table "public"."request_status_history" add constraint "request_status_history_request_id_fkey" FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE not valid;

alter table "public"."request_status_history" validate constraint "request_status_history_request_id_fkey";

alter table "public"."service_requests" add constraint "service_requests_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) not valid;

alter table "public"."service_requests" validate constraint "service_requests_assigned_by_fkey";

alter table "public"."service_requests" add constraint "service_requests_assigned_org_id_fkey" FOREIGN KEY (assigned_org_id) REFERENCES public.organizations(id) ON DELETE SET NULL not valid;

alter table "public"."service_requests" validate constraint "service_requests_assigned_org_id_fkey";

alter table "public"."service_requests" add constraint "service_requests_assigned_staff_id_fkey" FOREIGN KEY (assigned_staff_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."service_requests" validate constraint "service_requests_assigned_staff_id_fkey";

alter table "public"."service_requests" add constraint "service_requests_closed_by_fkey" FOREIGN KEY (closed_by) REFERENCES public.profiles(id) not valid;

alter table "public"."service_requests" validate constraint "service_requests_closed_by_fkey";

alter table "public"."service_requests" add constraint "service_requests_member_id_fkey" FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."service_requests" validate constraint "service_requests_member_id_fkey";

alter table "public"."service_requests" add constraint "service_requests_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL not valid;

alter table "public"."service_requests" validate constraint "service_requests_service_id_fkey";

alter table "public"."services" add constraint "services_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."services" validate constraint "services_organization_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS public.user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
    public.normalize_user_role(
      COALESCE(
        auth.jwt() -> 'app_metadata' ->> 'role',
        'community_member'
      )
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_user_role(role_text text)
 RETURNS public.user_role
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  RETURN CASE
    WHEN role_text = 'community_member' THEN 'community_member'::public.user_role
    WHEN role_text = 'organization'     THEN 'organization'::public.user_role
    -- SECURITY: Admin role cannot be self-assigned via signup.
    ELSE 'community_member'::public.user_role
  END;
END;
$function$
;


  create policy "conversations_select"
  on "public"."conversations"
  as permissive
  for select
  to public
using (((member_id = auth.uid()) OR (organization_id = public.get_user_org_id()) OR (public.get_user_role() = 'admin'::public.user_role)));



  create policy "comments_select"
  on "public"."forum_comments"
  as permissive
  for select
  to public
using (((is_moderated = false) OR (public.get_user_role() = 'admin'::public.user_role)));



  create policy "comments_update"
  on "public"."forum_comments"
  as permissive
  for update
  to public
using (((author_id = auth.uid()) OR (public.get_user_role() = 'admin'::public.user_role)));



  create policy "threads_select"
  on "public"."forum_threads"
  as permissive
  for select
  to public
using (((is_moderated = false) OR (public.get_user_role() = 'admin'::public.user_role)));



  create policy "threads_update"
  on "public"."forum_threads"
  as permissive
  for update
  to public
using (((author_id = auth.uid()) OR (public.get_user_role() = 'admin'::public.user_role)));



  create policy "messages_insert"
  on "public"."messages"
  as permissive
  for insert
  to public
with check (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.member_id = auth.uid()) OR (c.organization_id = public.get_user_org_id())))))));



  create policy "messages_select"
  on "public"."messages"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.member_id = auth.uid()) OR (c.organization_id = public.get_user_org_id()) OR (public.get_user_role() = 'admin'::public.user_role))))));



  create policy "org_members_delete_restricted"
  on "public"."organization_members"
  as permissive
  for delete
  to authenticated
using ((public.is_org_owner_or_admin(organization_id) OR (profile_id = auth.uid()) OR public.is_admin()));



  create policy "org_members_insert_restricted"
  on "public"."organization_members"
  as permissive
  for insert
  to authenticated
with check ((public.is_admin() OR public.is_org_owner_or_admin(organization_id) OR ((profile_id = auth.uid()) AND (NOT public.org_has_members(organization_id)))));



  create policy "org_members_select_same_org"
  on "public"."organization_members"
  as permissive
  for select
  to authenticated
using ((organization_id IN ( SELECT get_my_org_ids.get_my_org_ids
   FROM public.get_my_org_ids() get_my_org_ids(get_my_org_ids))));



  create policy "org_members_update_restricted"
  on "public"."organization_members"
  as permissive
  for update
  to authenticated
using ((public.is_org_owner_or_admin(organization_id) OR public.is_admin()));



  create policy "Org admins can create staff invites"
  on "public"."organization_staff_invites"
  as permissive
  for insert
  to authenticated
with check (((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_staff_invites.organization_id) AND (om.profile_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) AND (invited_by = auth.uid())));



  create policy "Org admins can delete staff invites"
  on "public"."organization_staff_invites"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_staff_invites.organization_id) AND (om.profile_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "Org admins can read staff invites"
  on "public"."organization_staff_invites"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_staff_invites.organization_id) AND (om.profile_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) OR ((accepted_at IS NULL) AND (lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))));



  create policy "orgs_delete_admin"
  on "public"."organizations"
  as permissive
  for delete
  to public
using ((public.get_user_role() = 'admin'::public.user_role));



  create policy "orgs_insert_role_restricted"
  on "public"."organizations"
  as permissive
  for insert
  to authenticated
with check (((public.get_user_role() = ANY (ARRAY['organization'::public.user_role, 'admin'::public.user_role])) AND ((owner_id = auth.uid()) OR public.is_admin())));



  create policy "orgs_select_approved"
  on "public"."organizations"
  as permissive
  for select
  to public
using (((status = 'approved'::public.org_status) OR (owner_id = auth.uid()) OR public.is_admin()));



  create policy "orgs_update_own"
  on "public"."organizations"
  as permissive
  for update
  to public
using (((owner_id = auth.uid()) OR (public.get_user_role() = 'admin'::public.user_role)));



  create policy "profiles_select_for_orgs"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((public.is_organization() OR public.is_admin()));



  create policy "notes_insert_org"
  on "public"."request_notes"
  as permissive
  for insert
  to public
with check (((public.get_user_role() = ANY (ARRAY['organization'::public.user_role, 'admin'::public.user_role])) AND (author_id = auth.uid())));



  create policy "notes_select_org"
  on "public"."request_notes"
  as permissive
  for select
  to public
using (((public.get_user_role() = ANY (ARRAY['organization'::public.user_role, 'admin'::public.user_role])) OR ((is_internal = false) AND (EXISTS ( SELECT 1
   FROM public.service_requests r
  WHERE ((r.id = request_notes.request_id) AND (r.member_id = auth.uid())))))));



  create policy "status_history_insert"
  on "public"."request_status_history"
  as permissive
  for insert
  to public
with check (((changed_by = auth.uid()) AND (public.get_user_role() = ANY (ARRAY['organization'::public.user_role, 'admin'::public.user_role]))));



  create policy "status_history_select"
  on "public"."request_status_history"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.service_requests r
  WHERE ((r.id = request_status_history.request_id) AND ((r.member_id = auth.uid()) OR (r.assigned_org_id = public.get_user_org_id()) OR (public.get_user_role() = 'admin'::public.user_role))))));



  create policy "requests_select_member"
  on "public"."service_requests"
  as permissive
  for select
  to public
using (((member_id = auth.uid()) OR (assigned_org_id IN ( SELECT get_my_org_ids.get_my_org_ids
   FROM public.get_my_org_ids() get_my_org_ids(get_my_org_ids))) OR public.is_admin()));



  create policy "requests_update_role_checked"
  on "public"."service_requests"
  as permissive
  for update
  to authenticated
using ((((assigned_org_id IN ( SELECT get_my_org_ids.get_my_org_ids
   FROM public.get_my_org_ids() get_my_org_ids(get_my_org_ids))) AND (public.get_user_role() = ANY (ARRAY['organization'::public.user_role, 'admin'::public.user_role]))) OR public.is_admin()));



  create policy "services_manage_own_org"
  on "public"."services"
  as permissive
  for all
  to public
using (((organization_id = public.get_user_org_id()) OR (public.get_user_role() = 'admin'::public.user_role)));



  create policy "services_select_active"
  on "public"."services"
  as permissive
  for select
  to public
using (((is_available = true) OR (organization_id = public.get_user_org_id()) OR (public.get_user_role() = 'admin'::public.user_role)));


CREATE TRIGGER forum_comments_updated_at BEFORE UPDATE ON public.forum_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER forum_threads_updated_at BEFORE UPDATE ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER messages_update_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER profiles_no_role_self_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER notes_updated_at BEFORE UPDATE ON public.request_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER service_requests_updated_at BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

drop trigger if exists "on_auth_user_created" on "auth"."users";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


