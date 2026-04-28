/**
 * Auth API - Clean authentication functions
 */
import { supabase } from "../lib/supabase";
import { getSiteUrlForAuth } from "../lib/siteUrl";
import type { UserRole } from "../types/user";

export type SignUpInput = {
  email: string;
  password: string;
  name?: string;
  role: Exclude<UserRole, "admin">;
  organization?: string;
  borough?: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type Profile = {
  id: string;
  email?: string;
  full_name?: string | null;
  role?: UserRole | null;
  avatar_url?: string | null;
  phone?: string | null;
  borough?: string | null;
};

type CachedProfileEntry = {
  value: Profile | null;
  fetchedAt: number;
};

// Module-level cache to avoid refetching the same profile on route/tab changes.
// This is intentionally simple and in-memory (clears on hard refresh).
const profileCache = new Map<string, CachedProfileEntry>();
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const authApi = {
  /**
   * Sign up a new user with Supabase Auth
   */
  async signUp(input: SignUpInput) {
    const siteUrl = getSiteUrlForAuth();
    const emailRedirectTo = siteUrl ? `${siteUrl}/auth/callback` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo,
        data: {
          full_name: input.name,
          role: input.role,
          organization: input.organization,
          borough: input.borough,
        },
      },
    });

    if (error) throw error;

    const user = data.user;
    if (!user) {
      throw new Error(
        "Could not complete sign up. Please try again or sign in if you already have an account.",
      );
    }

    // With "Confirm email" enabled, Supabase returns 200 and a fake user for duplicate
    // signups (no new identity). Email confirmation off surfaces "User already registered" on `error` instead.
    const identities = user.identities ?? [];
    if (identities.length === 0) {
      throw new Error(
        "An account with this email already exists. Please sign in instead.",
      );
    }

    return { user, session: data.session };
  },

  /**
   * Sign in with email/password
   */
  async signIn(input: SignInInput) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Send a password reset email (requires email delivery configured in Supabase).
   */
  async sendPasswordReset(email: string) {
    const siteUrl = getSiteUrlForAuth();
    const redirectTo = siteUrl ? `${siteUrl}/auth/callback` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  },

  /**
   * Sign out current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Fetch user profile from profiles table
   */
  async fetchProfile(userId: string, opts?: { force?: boolean }): Promise<Profile | null> {
    const force = opts?.force === true;
    if (!force) {
      const cached = profileCache.get(userId);
      if (cached && Date.now() - cached.fetchedAt < PROFILE_CACHE_TTL_MS) {
        return cached.value;
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, full_name, avatar_url, phone, borough")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error('[fetchProfile] Failed to load profile for user:', userId,
        'Error:', error.message, 'Code:', error.code)
      profileCache.set(userId, { value: null, fetchedAt: Date.now() });
      return null;
    }

    if (!data) {
      console.warn('[fetchProfile] No profile row found for user:', userId,
        '— check if profiles row exists and RLS SELECT policy allows access')
    }

    const result = data as Profile | null;
    profileCache.set(userId, { value: result, fetchedAt: Date.now() });
    return result;
  },

  /**
   * Upsert user profile
   */
  async upsertProfile(profile: Partial<Profile> & { id: string }) {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(profile)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  },

  /**
   * Get user role - checks metadata first, then profile
   */
  async getResolvedRole(
    userId: string,
    metadataRole?: unknown,
  ): Promise<UserRole> {
    const profile = await this.fetchProfile(userId);

    // Prefer DB truth. Metadata can be stale (or missing) across sessions.
    const dbRole = profile?.role ?? null;
    if (dbRole === "community_member" || dbRole === "organization" || dbRole === "admin") {
      return dbRole;
    }

    if (
      metadataRole === "community_member" ||
      metadataRole === "organization" ||
      metadataRole === "admin"
    ) {
      return metadataRole;
    }

    return "community_member";
  },
};
