import { supabase } from "../lib/supabase";

export const orgsApi = {
  // Get all approved orgs (for map + browse)
  async getApproved(filters?: { borough?: string; category?: string }) {
    let query = supabase
      .from("organizations")
      .select(`
        id, name, description, borough, address, latitude, longitude,
        category, languages_supported, status, hours_of_operation,
        email, phone, website, is_active,
        services(
          id, name, category, description, is_available, hours,
          latitude, longitude
        )
      `)
      .eq("status", "approved")
      .eq("is_active", true);

    if (filters?.borough) query = query.eq("borough", filters.borough);
    if (filters?.category)
      query = query.contains("category", [filters.category]);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Admin: get all orgs including pending
  async getAll(opts?: { page?: number; pageSize?: number }) {
    const pageSize = Math.max(1, Math.min(200, opts?.pageSize ?? 50));
    const page = Math.max(1, opts?.page ?? 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("organizations")
      .select(`
        id, name, borough, status, created_at, approved_at, rejection_reason,
        email, phone, category, is_active,
        owner:profiles!owner_id(full_name, email)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return data;
  },

  // Admin: approve or reject org
  async updateStatus(
    orgId: string,
    status: "approved" | "rejected" | "suspended",
    reason?: string,
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const updatePayload: Record<string, unknown> = {
      status,
      approved_by: user!.id,
      rejection_reason: status === "rejected" ? reason : null,
    };
    if (status === "approved") {
      updatePayload.approved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("organizations")
      .update(updatePayload)
      .eq("id", orgId);
    if (error) throw error;
  },

  // Admin: delete an organization (cascades services/members/etc via FK rules)
  async delete(orgId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("organizations").delete().eq("id", orgId);
    if (error) throw error;
  },

  /**
   * Invokes the edge function to provision a new organization for the current user.
   */
  async setup() {
    const { data, error } = await supabase.functions.invoke("setup-organization");
    if (error) throw error;
    return data;
  },
};
