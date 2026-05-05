import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User, UserRole } from "../types/user";
import { supabase } from "../lib/supabase";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { authApi } from "../api/auth";
import { orgsApi } from "../api/organizations";
import { withTimeout } from "../lib/withTimeout";

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
  retryAuth: () => Promise<void>;
  isLoading: boolean;
  isResolvingRole: boolean;
  isSubmitting: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingRole, setIsResolvingRole] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const orgSetupAttempted = useRef(false);
  const didBootstrapOrgForUserRef = useRef<string | null>(null);
  const bootstrapInFlightRef = useRef(false);

  const clearAuthError = () => setAuthError(null);

  const invokeSetupOrganization = async () => {
    try {
      const data = await orgsApi.setup();
      if (data?.success) {
        // Refresh profile to get the new organization context
        await refreshProfile();
      }
    } catch (err) {
      console.error('[Auth] Organization setup failed:', err);
    }
  };

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
    
    // Skip if already successfully bootstrapped this session.
    if (didBootstrapOrgForUserRef.current === input.userId) return;
    // Guard setup-organization so it only runs ONCE per session/mount
    if (orgSetupAttempted.current) return;
    // Avoid repeated calls if a previous one is still running.
    if (bootstrapInFlightRef.current) return;

    try {
      bootstrapInFlightRef.current = true;
      orgSetupAttempted.current = true;
      console.log('[Bootstrap] Checking if org setup is needed for user:', input.userId);
      
      // Double check membership before hitting the edge function
      const { data: existing } = await withTimeout(
        async (signal) => await supabase.from('organization_members').select('id').eq('profile_id', input.userId).abortSignal(signal).maybeSingle(),
        3000
      );

      if (existing) {
        console.log('[Bootstrap] User already has organization membership, skipping setup.');
        didBootstrapOrgForUserRef.current = input.userId;
        return;
      }

      console.log('[Bootstrap] No membership found, invoking setup-organization edge function...');
      await invokeSetupOrganization();
      didBootstrapOrgForUserRef.current = input.userId;
    } catch (e: unknown) {
      console.error("[Bootstrap] Org setup failed.", e);
      // We don't set a global auth error here to avoid blocking the whole app 
      // if only the org setup fails.
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

  const fetchProfileWithRetry = useCallback(async (userId: string): Promise<Profile | null> => {
    // Attempt 1 — short timeout; most users have a profile row ready immediately.
    console.log('[Auth] Profile fetch attempt 1/2...');
    const first = await withTimeout(
      (signal) => authApi.fetchProfile(userId, { signal }),
      3000,
    );
    if (first) return first;

    // Brief pause — DB trigger may need a moment for brand-new users.
    await sleep(1500);

    // Attempt 2 — last chance before JWT-metadata fallback takes over.
    console.log('[Auth] Profile fetch attempt 2/2...');
    return await withTimeout(
      (signal) => authApi.fetchProfile(userId, { signal }),
      4000,
    );
  }, []);

  const initializeAuth = useCallback(async (isMounted: () => boolean) => {
    try {
      console.log("[AuthContext] initializeAuth started");
      clearAuthError();
      setIsResolvingRole(true);

      console.log("[AuthContext] Calling getSession...");
      const { data: { session: sess }, error: sessError } = await withTimeout(
        () => supabase.auth.getSession(),
        5000
      );
      
      if (sessError) {
        console.error("[AuthContext] getSession error:", sessError);
      }
      
      if (!isMounted()) return;

      if (!sess) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsResolvingRole(false);
        setIsLoading(false);
        return;
      }

      // Session exists → check for expiry and refresh if needed
      let session = sess;
      const expiresAt = sess.expires_at ?? 0;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const secondsUntilExpiry = expiresAt - nowSeconds;
      
      if (secondsUntilExpiry < 300) {
        console.log("[AuthContext] Session expiring soon, refreshing...");
        try {
          const refreshResult = await withTimeout(
            () => supabase.auth.refreshSession(),
            5000
          );
          if (refreshResult?.data?.session) {
            session = refreshResult.data.session;
          }
        } catch (refreshError) {
          console.warn("[AuthContext] refreshSession timed out; continuing with existing session.", refreshError);
        }
      }

      if (!isMounted()) return;
      setSession(session);
      currentUserIdRef.current = session.user.id;

      const supaUser = session.user;
      const mapped = mapSupabaseUserToAppUser(supaUser);
      
      // Start both fetches in parallel
      const profilePromise = fetchProfileWithRetry(supaUser.id);
      
      const membershipPromise = (mapped.role === 'organization')
        ? withTimeout(
            async (signal) => await supabase.from('organization_members').select('role').eq('profile_id', supaUser.id).abortSignal(signal).maybeSingle(),
            5000
          )
        : Promise.resolve({ data: null, error: null });

      const [profileData, membershipResult] = await Promise.all([
        profilePromise,
        membershipPromise
      ]);
      console.log("[AuthContext] Fetched profile/membership:", { hasProfile: !!profileData, hasMembership: !!membershipResult });

      const membership = (membershipResult as any)?.data ?? null;

      if (!isMounted()) return;

      if (!profileData) {
        // Profile row not found after fast retries — fall back to JWT metadata
        // so navigation can proceed immediately in AuthPage.
        console.warn("[AuthContext] Profile not found — using metadata fallback.");
        applyResolvedIdentity(mapped, null);
        
        // Ensure UI can navigate now
        setIsResolvingRole(false);
        setIsLoading(false);

        // Background retry: attempt once more after 5 seconds
        setTimeout(async () => {
          if (!isMounted()) return;
          const retried = await authApi.fetchProfile(supaUser.id);
          if (retried && isMounted()) {
            applyResolvedIdentity(mapped, retried);
          }
        }, 5000);
        return;
      }

      applyResolvedIdentity(mapped, profileData);

      // SEC-AUDIT: Do NOT sync role to user_metadata. user_metadata is client-writable
      // and trusting it in RLS (as migration 016 did) is a security risk.
      // Roles should be managed via app_metadata (server-side) or the profiles table.
      /*
      if (profileData.role && mapped.role !== profileData.role) {
        supabase.auth.updateUser({ data: { role: profileData.role } }).then(({ error }) => {
          if (error) console.error('[Auth] Failed to sync metadata role:', error.message)
        })
      }
      */

      const resolvedRole = (profileData.role as UserRole) ?? mapped.role;
      if (resolvedRole === 'organization') {
        if (!membership || membership.role === 'owner') {
          void maybeBootstrapOrganization({
            userId: supaUser.id,
            email: mapped.email,
            role: resolvedRole,
            organizationName: mapped.organization,
            borough: profileData?.borough ?? undefined,
          });
        }
      }
    } catch (e) {
      console.error("[AuthContext:initializeAuth] Failed.", e);
      if (isMounted()) {
        setAuthError(
          e instanceof Error ? e.message : "Unable to initialize session.",
        );
      }
    } finally {
      // AuthProvider is a persistent root component. We always want to clear
      // the loading state even if a specific useEffect run is no longer "current"
      // (isMounted false), to ensure the app doesn't stay stuck in a spinner.
      setIsResolvingRole(false);
      setIsLoading(false);
    }
  }, [mapSupabaseUserToAppUser, fetchProfileWithRetry]);

  const retryAuth = useCallback(async () => {
    setAuthError(null);
    setIsResolvingRole(true);
    // Passing a dummy isMounted that always returns true for the retry action
    await initializeAuth(() => true);
  }, [initializeAuth]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'HP_AUTH_COMPLETE') {
        void initializeAuth(() => true);
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [initializeAuth])

  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    let isMounted = true;
    void initializeAuth(() => isMounted);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        const nextUserId = nextSession?.user?.id ?? null;

        if (event === "SIGNED_OUT") {
          currentUserIdRef.current = null;
          if (!isMounted) return;
          setSession(null);
          setUser(null);
          setProfile(null);
          didBootstrapOrgForUserRef.current = null;
          orgSetupAttempted.current = false;
          setIsResolvingRole(false);
          setIsLoading(false);
          return;
        }

        // For SIGNED_IN: only trigger full initialization if the user has changed.
        // Supabase fires SIGNED_IN on window focus even if the session is unchanged.
        if (event === "SIGNED_IN") {
          if (nextUserId && nextUserId === currentUserIdRef.current) {
            console.log("[AuthContext] SIGNED_IN fired but user unchanged, skipping re-init");
            if (nextSession) setSession(nextSession);
            return;
          }

          currentUserIdRef.current = nextUserId;
          setIsResolvingRole(true);
          try {
            await initializeAuth(() => isMounted);
          } catch (error) {
            console.error("[AuthContext] Error handling SIGNED_IN:", error);
          } finally {
            setIsResolvingRole(false);
            setIsLoading(false);
          }
          return;
        }

        if (event === "INITIAL_SESSION") {
          if (nextUserId && nextUserId === currentUserIdRef.current && user) {
            if (nextSession) setSession(nextSession);
            return;
          }
          currentUserIdRef.current = nextUserId;
          setIsResolvingRole(true);
          try {
            await initializeAuth(() => isMounted);
          } catch (error) {
            console.error("[AuthContext] Error handling INITIAL_SESSION:", error);
          } finally {
            setIsResolvingRole(false);
            setIsLoading(false);
          }
          return;
        }

        if (nextUserId && nextUserId === currentUserIdRef.current && nextSession) {
          setSession(nextSession);
        }
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [initializeAuth]);

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
          await invokeSetupOrganization();
        } catch (e: unknown) {
          // Non-blocking — avoid logging user-provided org details.
          console.error("[Signup] Org setup failed.", e);
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
      (signal) => authApi.fetchProfile(supaUser.id, { signal }),
      1500,
    );
    const mapped = mapSupabaseUserToAppUser(supaUser);
    applyResolvedIdentity(mapped, profileData);
  };

  const value = useMemo(() => ({
    user,
    profile,
    session,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    retryAuth,
    isLoading,
    isResolvingRole,
    isSubmitting,
    authError,
    clearAuthError,
  }), [
    user,
    profile,
    session,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    retryAuth,
    isLoading,
    isResolvingRole,
    isSubmitting,
    authError,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {authError ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
            <h1 className="text-lg font-bold text-gray-900">Sign-in error</h1>
            <p className="text-sm text-gray-600 mt-2">{authError}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void retryAuth()}
                className="h-10 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
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
