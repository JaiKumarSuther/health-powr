/**
 * Organizations API - Clean organization CRUD operations
 */
import { supabase } from "./supabase";

export type OrgStatus = "pending" | "approved" | "rejected" | "suspended";

export type CreateOrganizationInput = {
  ownerId: string;
  name: string;
  borough?: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
};

export type OrganizationRow = {
  id: string;
  owner_id: string | null;
  name: string;
  borough: string;
  status: OrgStatus;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  created_at?: string;
};

export type OrganizationMember = {
  id: string;
  organization_id: string;
  profile_id: string;
  role: string;
  joined_at: string;
};

export const organizationsApi = {
  async withTimeout<T>(p: PromiseLike<T>, ms = 3000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        Promise.resolve(p),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Request timed out")), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  },

  /**
   * Check if user already has an organization
   */
  async getOrganizationByOwner(
    ownerId: string,
  ): Promise<OrganizationRow | null> {
    // Important: always select the columns our app expects (borough/status/etc)
    // so downstream code doesn't hit undefined fields and re-render loops.
    const request = supabase
      .from("organizations")
      .select(
        "id, owner_id, name, borough, status, email, phone, address, description, created_at",
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await this.withTimeout(request, 2000);

    if (error) {
      return null;
    }
    if (!data) {
      return null;
    }

    return data as OrganizationRow | null;
  },

  /**
   * Creates an organization with status `pending`.
   * Enforces: only one organization per owner account.
   * Returns existing organization if one already exists.
   */
  async createOrganization(
    input: CreateOrganizationInput,
  ): Promise<OrganizationRow> {
    const name = input.name.trim();
    if (!name) throw new Error("Organization name is required.");

    // 1) Check for existing org (one per account)
    const existing = await this.getOrganizationByOwner(input.ownerId);
    if (existing) {
      return existing;
    }

    // 2) Create organization as pending
    const { data: created, error: createdError } = await supabase
      .from("organizations")
      .insert({
        owner_id: input.ownerId,
        name,
        borough: input.borough || "Manhattan",
        email: input.email,
        phone: input.phone,
        address: input.address,
        description: input.description,
        status: "pending" as OrgStatus,
        is_active: true,
      })
      .select(
        "id, owner_id, name, borough, status, email, phone, address, description, created_at",
      )
      .single();

    if (createdError) throw createdError;
    return created as OrganizationRow;
  },

  /**
   * Add user as member of organization (with role)
   */
  async addOrganizationMember(
    organizationId: string,
    profileId: string,
    role: "owner" | "admin" | "member" = "owner",
  ): Promise<OrganizationMember> {
    // Check if membership already exists
    const { data: existing } = await supabase
      .from("organization_members")
      .select("id, profile_id, organization_id, role, joined_at")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (existing) {
      return existing as OrganizationMember;
    }

    const { data, error } = await supabase
      .from("organization_members")
      .insert({
        organization_id: organizationId,
        profile_id: profileId,
        role,
      })
      .select()
      .single();

    if (error) {
      // Ignore duplicate errors
      if (
        error.message?.toLowerCase().includes("duplicate") ||
        error.message?.toLowerCase().includes("unique")
      ) {
        const { data: refetch } = await supabase
          .from("organization_members")
          .select("id, profile_id, organization_id, role, joined_at")
          .eq("organization_id", organizationId)
          .eq("profile_id", profileId)
          .single();
        return refetch as OrganizationMember;
      }
      throw error;
    }

    return data as OrganizationMember;
  },

  /**
   * Complete organization setup: create org + add owner as member
   * This is the main function to call during signup
   */
  async setupOrganizationForUser(input: CreateOrganizationInput): Promise<{
    organization: OrganizationRow;
    membership: OrganizationMember;
  }> {
    // Create the organization
    const organization = await this.createOrganization(input);

    // Add user as owner/admin of the organization
    const membership = await this.addOrganizationMember(
      organization.id,
      input.ownerId,
      "owner",
    );

    return { organization, membership };
  },

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string): Promise<OrganizationRow | null> {
    const { data, error } = await supabase
      .from("organizations")
      .select(
        "id, owner_id, name, borough, status, email, phone, address, description, created_at",
      )
      .eq("id", id)
      .single();

    if (error) return null;
    return data as OrganizationRow;
  },

  /**
   * Get user's organization membership
   */
  async getUserOrganization(userId: string): Promise<OrganizationRow | null> {
    // Prefer membership org first. This avoids a common mismatch where a user
    // "owns" an org record but is actively working under a different org as staff.
    // Owners are also added as members during setup, so this still returns the
    // correct org for owners. Use limit(1) to be safe if duplicates exist.
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("profile_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership?.organization_id) return null;

    const org = await this.getOrganizationById(membership.organization_id);
    if (org) return org;

    // Fallback: owned org (legacy/edge cases where membership row doesn't exist)
    return this.getOrganizationByOwner(userId);
  },
};
