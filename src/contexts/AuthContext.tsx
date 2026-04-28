import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User, UserRole } from "../types/user";
import { supabase } from "../lib/supabase";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { authApi } from "../api/auth";

type Profile = {
  id: string;
  email?: string;
  full_name?: string | null;
  role?: UserRole | null;
  avatar_url?: string | null;
  phone?: string | null;
  borough?: string | null;
};

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signUp: (params: {
    email: string;
    password: string;
    name?: string;
    role: Exclude<UserRole, "admin">;
    organization?: string;
    borough?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
  isResolvingRole: boolean;
  isSubmitting: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingRole, setIsResolvingRole] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const didBootstrapOrgForUserRef = useRef<string | null>(null);
  const bootstrapInFlightRef = useRef(false);

  async function invokeSetupOrganization(orgName: string, borough: string) {
    const { error } = await supabase.functions.invoke('setup-organization', {
      body: { orgName, borough },
    })
    if (error) throw error
  }
  const maybeBootstrapOrganization = async (input: {
    userId: string;
    email: string;
    role: UserRole;
    organizationName?: string;
    borough?: string;
  }) => {
    if (input.role !== "organization") return;

    const orgName =
      input.organizationName?.trim() ||
      session?.user?.user_metadata?.organization?.trim() ||
      'My Organization'
    const borough =
      input.borough?.trim() ||
      session?.user?.user_metadata?.borough?.trim() ||
      'Brooklyn'

    // Skip if already successfully bootstrapped this session.
    if (didBootstrapOrgForUserRef.current === input.userId) return;
    // Avoid repeated calls if a previous one is still running.
    if (bootstrapInFlightRef.current) return;

    try {
      bootstrapInFlightRef.current = true;
      console.log('[Bootstrap] Starting org setup for user:', input.userId, 'org:', orgName);
      await invokeSetupOrganization(orgName, borough);
      // Only mark as done after a successful creation so a transient failure
      // does not permanently block the org from being created.
      didBootstrapOrgForUserRef.current = input.userId;
    } catch {
      // Non-blocking — will be retried on the next auth state change.
    } finally {
      bootstrapInFlightRef.current = false;
    }
  };

  const applyResolvedIdentity = (mapped: User, profileData: Profile | null) => {
    const nextUser: User = {
      ...mapped,
      role: (profileData?.role as UserRole) ?? mapped.role,
      name: profileData?.full_name ?? mapped.name,
      avatar: profileData?.avatar_url ?? mapped.avatar,
    };

    setProfile((prev) => {
      if (
        prev?.id === profileData?.id &&
        prev?.role === profileData?.role &&
        prev?.full_name === profileData?.full_name &&
        prev?.avatar_url === profileData?.avatar_url &&
        prev?.phone === profileData?.phone &&
        prev?.borough === profileData?.borough
      ) {
        return prev;
      }
      return profileData;
    });

    setUser((prev) => {
      if (
        prev?.id === nextUser.id &&
        prev?.email === nextUser.email &&
        prev?.name === nextUser.name &&
        prev?.role === nextUser.role &&
        prev?.organization === nextUser.organization &&
        prev?.avatar === nextUser.avatar
      ) {
        return prev;
      }
      return nextUser;
    });
  };

  const mapSupabaseUserToAppUser = useMemo(() => {
    return (supabaseUser: SupabaseUser): User => {
      const metadata = (supabaseUser.user_metadata ?? {}) as Record<
        string,
        unknown
      >;
      const roleFromMeta = metadata.role;
      const role: UserRole =
        roleFromMeta === "community_member" ||
        roleFromMeta === "organization" ||
        roleFromMeta === "admin"
          ? roleFromMeta
          : "community_member";

      const email = supabaseUser.email ?? "";
      const nameFromMeta =
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : undefined;
      const nameFromEmail = email ? email.split("@")[0] : "User";
      const name = nameFromMeta ?? nameFromEmail;
      const organization =
        typeof metadata.organization === "string"
          ? metadata.organization
          : undefined;
      const avatar =
        typeof metadata.avatar === "string" ? metadata.avatar : undefined;

      return {
        id: supabaseUser.id,
        email,
        name,
        role,
        organization,
        avatar,
      };
    };
  }, []);

  const fetchProfile = async (id: string): Promise<Profile | null> => {
    // Use the clean authApi
    return authApi.fetchProfile(id);
  };

  // Helper: wrap a promise with a timeout so long-running requests don't block UI
  const withTimeout = async <T,>(
    p: Promise<T>,
    ms = 3000,
  ): Promise<T | null> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const result = await Promise.race([
        p,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), ms);
        }),
      ]);
      return result as T | null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'HP_AUTH_COMPLETE') {
        // Simple professional behavior: do NOT hard-reload the SPA.
        // The auth state listener should hydrate automatically once storage updates.
        void supabase.auth.getSession().then(() => {})
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        // Single session call — no unconditional refresh
        const {
          data: { session: sess },
        } = await supabase.auth.getSession();
        if (!isMounted) return;
        // Only refresh if token is close to expiry (within 5 minutes)
        // Supabase tokens expire every 3600s by default
        let session = sess ?? null;
        if (sess) {
          const expiresAt = sess.expires_at ?? 0;
          const nowSeconds = Math.floor(Date.now() / 1000);
          const secondsUntilExpiry = expiresAt - nowSeconds;
          if (secondsUntilExpiry < 300) {
            // Token expires in < 5 minutes — refresh it
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData.session) session = refreshData.session;
          }
        }

        if (!isMounted) return;
        setSession(session);

        const supaUser = session?.user ?? null;
        if (!supaUser) {
          setUser(null);
          setProfile(null);
          setIsResolvingRole(false);
          return;
        }

        const mapped = mapSupabaseUserToAppUser(supaUser);
        const profileData = await withTimeout(fetchProfile(supaUser.id), 3000);
        if (!isMounted) return;
        // No org bootstrap on login.
        applyResolvedIdentity(mapped, profileData);

        // Sync user_metadata.role if profile role differs from metadata role.
        if (profileData?.role && mapped.role !== profileData.role) {
          supabase.auth.updateUser({ data: { role: profileData.role } }).then(({ error }) => {
            if (error) console.error('[Auth] Failed to sync metadata role:', error.message)
          })
        }

        // Fallback: if user signed up with email verification and no session existed at signup,
        // create the organization on first successful login.
        const resolvedRole = (profileData?.role as UserRole) ?? mapped.role;
        // Only bootstrap for org owners, not staff members (member/admin in organization_members).
        if (resolvedRole === 'organization') {
          supabase
            .from('organization_members')
            .select('role')
            .eq('profile_id', supaUser.id)
            .maybeSingle()
            .then(({ data: membership }) => {
              if (!membership || membership.role === 'owner') {
                void maybeBootstrapOrganization({
                  userId: supaUser.id,
                  email: mapped.email,
                  role: resolvedRole,
                  organizationName: mapped.organization,
                  borough: profileData?.borough ?? undefined,
                });
              }
            });
        }
      } catch {
        // Avoid logging session/bootstrap details in the client
      } finally {
        if (isMounted) setIsResolvingRole(false);
        if (isMounted) setIsLoading(false);
      }
    };

    void init();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        // If signIn() immediately signs the user out (role mismatch),
        // the SIGNED_OUT event should clear state without activating global spinners.
        if (event === "SIGNED_OUT") {
          if (!isMounted) return;
          setSession(null);
          setUser(null);
          setProfile(null);
          didBootstrapOrgForUserRef.current = null;
          setIsResolvingRole(false);
          setIsLoading(false);
          return;
        }

        setIsResolvingRole(true)
        try {
          if (!isMounted) return;
          setSession(nextSession ?? null);

          // Token refreshes should not re-hydrate user/profile; doing so re-triggers page data effects.
          if (event === "TOKEN_REFRESHED") return;

          const supaUser = nextSession?.user ?? null;
          if (!supaUser) {
            setUser(null);
            setProfile(null);
            didBootstrapOrgForUserRef.current = null;
            setIsResolvingRole(false)
            return;
          }

          if (supaUser) {
            const mapped = mapSupabaseUserToAppUser(supaUser);

            // Fetch profile ONCE — reuse for both role check and identity application.
            // This eliminates the triple-fetch race where fetch #2 (role check) could
            // succeed while fetch #3 (applyResolvedIdentity) timed out, causing the
            // admin to land on /client with a stale metadata role.
            const profileData = await withTimeout(
              authApi.fetchProfile(supaUser.id),
              3000,
            );
            if (!isMounted) return;

            // Apply identity using the same profileData — no second fetch.
            applyResolvedIdentity(mapped, profileData);

            // Sync user_metadata.role if profile role differs from metadata role.
            // This permanently fixes stale metadata so future sessions use the correct
            // role even if fetchProfile fails and the metadata fallback is used.
            if (profileData?.role && mapped.role !== profileData.role) {
              supabase.auth.updateUser({ data: { role: profileData.role } }).then(({ error }) => {
                if (error) console.error('[Auth] Failed to sync metadata role:', error.message)
                else console.log('[Auth] user_metadata.role synced to:', profileData.role)
              })
            }

            const resolvedRole = (profileData?.role as UserRole) ?? mapped.role;
            // Only bootstrap for org owners, not staff members (member/admin in organization_members).
            if (resolvedRole === 'organization') {
              supabase
                .from('organization_members')
                .select('role')
                .eq('profile_id', supaUser.id)
                .maybeSingle()
                .then(({ data: membership }) => {
                  if (!membership || membership.role === 'owner') {
                    void maybeBootstrapOrganization({
                      userId: supaUser.id,
                      email: mapped.email,
                      role: resolvedRole,
                      organizationName: mapped.organization,
                      borough: profileData?.borough ?? undefined,
                    });
                  }
                });
            }
          }
        } catch {
          // Avoid logging auth handler details in the client
        } finally {
          if (isMounted) setIsResolvingRole(false);
          if (isMounted) setIsLoading(false);
        }
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [mapSupabaseUserToAppUser]);

  const signIn: AuthContextType["signIn"] = async ({ email, password }) => {
    setIsSubmitting(true);
    try {
      // Step 1 — Supabase auth (establishes a session)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Role matches — onAuthStateChange will hydrate state normally.
    } finally {
      setIsSubmitting(false);
    }
  };

  const signUp: AuthContextType["signUp"] = async ({
    email,
    password,
    name,
    role,
    organization,
    borough,
  }) => {
    setIsSubmitting(true);
    try {
      // 1. Create auth user using clean API
      const { session: newSession } = await authApi.signUp({
        email,
        password,
        name,
        role,
        organization,
        borough,
      });

      // 2. Check if we have an active session (email confirmation might be required)
      const hasActiveSession = !!newSession;

      if (!hasActiveSession) {
        return;
      }

      // 3. If organization role, create the organization now via edge function
      if (role === "organization" && organization) {
        try {
          await invokeSetupOrganization(organization, borough || "Manhattan");
        } catch {
          // Non-blocking — do not log signup/org details in the client
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut: AuthContextType["signOut"] = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      // Clear local auth state immediately so UI updates without waiting for auth listener
      setSession(null);
      setUser(null);
      setProfile(null);
      // Always return to landing page after logout (all roles).
      if (typeof window !== "undefined") {
        window.location.assign("/");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshProfile: AuthContextType["refreshProfile"] = async () => {
    const { data } = await supabase.auth.getSession();
    const supaUser = data.session?.user ?? null;
    if (!supaUser) return;
    // Never block UI on profile refresh.
    const profileData = await withTimeout(
      authApi.fetchProfile(supaUser.id, { force: true }),
      1500,
    );
    const mapped = mapSupabaseUserToAppUser(supaUser);
    applyResolvedIdentity(mapped, profileData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        isLoading,
        isResolvingRole,
        isSubmitting,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
