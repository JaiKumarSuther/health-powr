import { supabase } from "../lib/supabase";
import type { ServiceCategory, RequestStatus } from "../lib/types";
import { requireUser } from "./requireUser";

type OrgMembershipRole = "owner" | "admin" | "member";

function clampPageSize(pageSize?: number) {
  return Math.max(1, Math.min(200, pageSize ?? 50));
}

function pageRange(opts?: { page?: number; pageSize?: number }) {
  const pageSize = clampPageSize(opts?.pageSize);
  const page = Math.max(1, opts?.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

export const requestsApi = {
  async getMyOrgId(): Promise<string | null> {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id ?? null;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("profile_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    return data?.organization_id ?? null;
  },

  async getMyOrgMembership(): Promise<{
    orgId: string | null;
    role: OrgMembershipRole | null;
    userId: string | null;
  }> {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id ?? null;
    if (!userId) return { orgId: null, role: null, userId: null };

    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("profile_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    return {
      orgId: data?.organization_id ?? null,
      role: (data?.role as OrgMembershipRole | undefined) ?? null,
      userId,
    };
  },

  async getOrgTeamMembers() {
    const ctx = await this.getMyOrgMembership();
    if (!ctx.orgId) return [];
    if (ctx.role === "member") return [];

    const { data, error } = await supabase
      .from("organization_members")
      .select(
        `
        profile_id,
        role,
        profile:profiles!profile_id(id, full_name, email)
      `,
      )
      .eq("organization_id", ctx.orgId)
      .in("role", ["member", "admin"])
      .order("joined_at", { ascending: true });

    if (error) throw error;
    return (data ?? []).map((m: any) => ({
      profile_id: m.profile_id,
      role: m.role as OrgMembershipRole,
      full_name: m.profile?.full_name ?? "Staff",
      email: m.profile?.email ?? "",
    }));
  },

  async resolveAutoAssignedOrgId(input: {
    borough: string;
    serviceId?: string;
  }): Promise<string | null> {
    // Prefer routing to the org that owns the selected service.
    if (input.serviceId) {
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("organization_id")
        .eq("id", input.serviceId)
        .maybeSingle();
      if (serviceError) throw serviceError;
      if (service?.organization_id) return service.organization_id;
    }

    // Otherwise, route to an approved org in the same borough (best-effort).
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("borough", input.borough)
      .eq("status", "approved")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (orgError) throw orgError;

    return org?.id ?? null;
  },

  // Community member: submit new request
  async create(data: {
    category: ServiceCategory;
    borough: string;
    description: string;
    service_id: string;
    need_categories?: string[];
    metadata?: Record<string, unknown>;
  }) {
    const user = await requireUser();

    const assignedOrgId = await this.resolveAutoAssignedOrgId({
      borough: data.borough,
      serviceId: data.service_id,
    });

    const { data: result, error } = await supabase
      .from("service_requests")
      .insert({
        category: data.category,
        borough: data.borough,
        description: data.description,
        service_id: data.service_id,
        member_id: user.id,
        assigned_org_id: assignedOrgId,
        need_categories: data.need_categories ?? [],
        metadata: data.metadata ?? {},
        status: assignedOrgId ? ("in_review" as RequestStatus) : ("new" as RequestStatus),
      })
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  // Community member: get their own requests
  async getMyRequests(opts?: { page?: number; pageSize?: number }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { from, to } = pageRange(opts);
    const { data, error } = await supabase
      .from("service_requests")
      .select(
        `
        *,
        organization:organizations(id, name, phone),
        status_history:request_status_history(
          new_status, note, created_at,
          changed_by:profiles(full_name)
        )
      `,
      )
      .eq("member_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return data;
  },

  // CBO: get requests assigned to their org
  async getOrgRequests(filters?: {
    status?: RequestStatus;
    category?: ServiceCategory;
  }, opts?: { page?: number; pageSize?: number }) {
    const ctx = await this.getMyOrgMembership();
    if (!ctx.orgId) return [];

    const { from, to } = pageRange(opts);
    let query = supabase
      .from("service_requests")
      .select(
        `
        *,
        assigned_staff:profiles!assigned_staff_id(
          id, full_name, email
        ),
        member:profiles!member_id(
          id, full_name, email, phone, borough
        ),
        notes:request_notes(
          id, content, is_internal, created_at,
          author_id,
          author:profiles(full_name)
        ),
        status_history:request_status_history(
          id, old_status, new_status, note, created_at,
          changed_by,
          changed_by_profile:profiles!changed_by(full_name)
        )
      `,
      )
      .eq("assigned_org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    // Staff members only see requests assigned to them.
    if (ctx.role === "member" && ctx.userId) {
      query = query.eq("assigned_staff_id", ctx.userId);
    }

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.category) query = query.eq("category", filters.category);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async assignToStaff(requestId: string, staffProfileId: string | null) {
    const ctx = await this.getMyOrgMembership();
    if (!ctx.orgId || !ctx.userId) throw new Error("Not in organization");
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      throw new Error("Only org directors/admins can assign requests");
    }

    if (!staffProfileId) {
      throw new Error("Please select a staff member to assign.");
    }

    const { data: currentRequest, error: fetchErr } = await supabase
      .from("service_requests")
      .select("status, assigned_staff_id")
      .eq("id", requestId)
      .eq("assigned_org_id", ctx.orgId)
      .maybeSingle();

    if (fetchErr || !currentRequest) {
      throw new Error("Request not found or access denied.");
    }

    if (currentRequest.assigned_staff_id) {
      throw new Error("This request already has an assigned staff member and cannot be reassigned.");
    }

    const { error: updateError } = await supabase
      .from("service_requests")
      .update({
        assigned_staff_id: staffProfileId,
      })
      .eq("id", requestId)
      .eq("assigned_org_id", ctx.orgId);
    if (updateError) throw updateError;

    let assigneeLabel = "Unassigned";
    if (staffProfileId) {
      const { data: assignee } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", staffProfileId)
        .maybeSingle();
      assigneeLabel = assignee?.full_name || assignee?.email || "Staff member";
    }

    // Write assignment action as internal note for timeline/audit.
    const { error: noteError } = await supabase.from("request_notes").insert({
      request_id: requestId,
      author_id: ctx.userId,
      is_internal: true,
      content: `[Assignment] ${staffProfileId ? `Assigned to ${assigneeLabel}` : "Cleared assignment"}`,
    });
    if (noteError) throw noteError;
  },

  // CBO: get requests that belong to services created by the org (service_id -> services.organization_id)
  async getOrgServiceRequests(filters?: {
    status?: RequestStatus;
    category?: ServiceCategory;
  }, opts?: { page?: number; pageSize?: number }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("profile_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const orgId = membership?.organization_id;
    if (!orgId) return [];

    // 1) Get all services for this org
    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("id")
      .eq("organization_id", orgId);
    if (servicesError) throw servicesError;

    const serviceIds = (services ?? []).map((s) => s.id).filter(Boolean);
    if (serviceIds.length === 0) return [];
    // 2) Fetch requests for any service owned by this org
    const { from, to } = pageRange(opts);
    let query = supabase
      .from("service_requests")
      .select(
        `
        *,
        member:profiles!member_id(
          id, full_name, email, phone, borough
        )
      `,
      )
      .in("service_id", serviceIds)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.category) query = query.eq("category", filters.category);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Admin: get ALL requests
  async getAllRequests(filters?: {
    status?: RequestStatus;
    org_id?: string;
    borough?: string;
  }, opts?: { page?: number; pageSize?: number }) {
    const { from, to } = pageRange(opts);
    let query = supabase
      .from("service_requests")
      .select(
        `
        *,
        member:profiles!member_id(full_name, email, borough),
        organization:organizations(name, borough)
      `,
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.org_id) query = query.eq("assigned_org_id", filters.org_id);
    if (filters?.borough) query = query.eq("borough", filters.borough);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // CBO/Admin: update request status
  async updateStatus(
    requestId: string,
    newStatus: RequestStatus,
    note?: string,
  ) {
    const ctx = await this.getMyOrgMembership();
    if (!ctx.orgId || !ctx.userId) throw new Error("Not in organization");

    // Get old status first
    let currentQuery = supabase
      .from("service_requests")
      .select("status")
      .eq("id", requestId)
      .eq("assigned_org_id", ctx.orgId);
    if (ctx.role === "member") {
      currentQuery = currentQuery.eq("assigned_staff_id", ctx.userId);
    }
    const { data: current } = await currentQuery.maybeSingle();
    if (!current) {
      throw new Error("You do not have permission to update this request.");
    }

    // Update status
    let updateQuery = supabase
      .from("service_requests")
      .update({
        status: newStatus,
        ...(newStatus === "closed"
          ? { closed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", requestId)
      .eq("assigned_org_id", ctx.orgId);
    if (ctx.role === "member") {
      updateQuery = updateQuery.eq("assigned_staff_id", ctx.userId);
    }
    const { error: updateError } = await updateQuery;
    if (updateError) throw updateError;

    // Log history
    const { error: historyError } = await supabase
      .from("request_status_history")
      .insert({
        request_id: requestId,
        changed_by: ctx.userId,
        old_status: current?.status,
        new_status: newStatus,
        note,
      });
    if (historyError) throw historyError;
  },

  // Admin: assign request to org
  async assignToOrg(requestId: string, orgId: string) {
    const user = await requireUser();
    const { error } = await supabase
      .from("service_requests")
      .update({
        assigned_org_id: orgId,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        status: "in_review",
      })
      .eq("id", requestId);
    if (error) throw error;
  },

  // Admin: export as CSV
  async exportCsv(opts?: { page?: number; pageSize?: number }) {
    const { from, to } = pageRange(opts);
    const { data, error } = await supabase
      .from("service_requests")
      .select(
        `
        id, category, borough, description, 
        status, priority, created_at,
        member:profiles!member_id(full_name, email),
        organization:organizations(name)
      `,
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return data;
  },

  // Admin: counts by status
  async getStatusCounts() {
    const { data, error } = await supabase
      .from("service_requests")
      .select("status");
    if (error) throw error;

    return data.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  },

  // CBO: counts by status for their org
  async getOrgStatusCounts() {
    const ctx = await this.getMyOrgMembership();
    if (!ctx.orgId || ctx.role === "member") return {};

    const { data, error } = await supabase
      .from("service_requests")
      .select("status")
      .eq("assigned_org_id", ctx.orgId);

    if (error) throw error;

    return data.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  },

  async getOrgTeamActivity(limit = 20) {
    const ctx = await this.getMyOrgMembership();
    if (!ctx.orgId || ctx.role === "member") return [];

    const [{ data: notes, error: notesError }, { data: statusHistory, error: historyError }] =
      await Promise.all([
        supabase
          .from("request_notes")
          .select(
            `
            id, request_id, content, created_at,
            request:service_requests!inner(id, assigned_org_id),
            author:profiles!author_id(full_name)
          `,
          )
          .eq("request.assigned_org_id", ctx.orgId)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("request_status_history")
          .select(
            `
            id, request_id, new_status, note, created_at,
            request:service_requests!inner(id, assigned_org_id),
            actor:profiles!changed_by(full_name)
          `,
          )
          .eq("request.assigned_org_id", ctx.orgId)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

    if (notesError) throw notesError;
    if (historyError) throw historyError;

    const merged = [
      ...(notes ?? []).map((n: any) => ({
        id: `note:${n.id}`,
        request_id: n.request_id,
        created_at: n.created_at,
        kind: "note",
        actor: n.author?.full_name || "Staff",
        text: n.content,
      })),
      ...(statusHistory ?? []).map((h: any) => ({
        id: `status:${h.id}`,
        request_id: h.request_id,
        created_at: h.created_at,
        kind: "status",
        actor: h.actor?.full_name || "Staff",
        text: `Changed status to ${String(h.new_status).replace("_", " ")}${h.note ? ` — ${h.note}` : ""}`,
      })),
    ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    return merged.slice(0, limit);
  },
};

export type ServiceRequest = {
  id: string;
  created_at: string;
  category: string;
  borough: string;
  description: string;
  service_id: string;
  member_id: string;
  assigned_org_id?: string;
  status: "in_review" | "approved" | "rejected" | "completed" | "pending";
  metadata: {
    urgency?: "urgent" | "this_week" | "exploring";
    household_size?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    note?: string;
  };
};

export function getRequestDisplayName(r: ServiceRequest): string {
  const first = r.metadata?.first_name;
  const last = r.metadata?.last_name;
  if (first || last) return `${first ?? ""} ${last ?? ""}`.trim();
  return "Unknown";
}

export function getUrgencyLabel(urgency?: string): string {
  if (urgency === "urgent") return "As soon as possible";
  if (urgency === "this_week") return "This week";
  if (urgency === "exploring") return "Just exploring";
  return "Not specified";
}

export function getUrgencyColor(urgency?: string): string {
  if (urgency === "urgent") return "text-red-600 bg-red-50";
  if (urgency === "this_week") return "text-amber-600 bg-amber-50";
  return "text-gray-500 bg-gray-50";
}
