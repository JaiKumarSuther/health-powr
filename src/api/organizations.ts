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
  async getAll() {
    const { data, error } = await supabase
      .from("organizations")
      .select(`
        id, name, borough, status, created_at, approved_at, rejection_reason,
        email, phone, category, is_active,
        owner:profiles!owner_id(full_name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(100);
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
};
