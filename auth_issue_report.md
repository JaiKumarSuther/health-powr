# Issue: Authentication Sign-In Hang

## Symptoms
- User attempts to sign in via `/auth?mode=signin`.
- Network request for `token?grant_type=password` returns **200 OK**.
- The "Sign in" button continues to show a loading spinner indefinitely.
- The application does not navigate to the dashboard (e.g., `/client` or `/cbo`).

## Root Cause Analysis
The issue is caused by a **hanging promise** during the authentication initialization sequence in `AuthContext.tsx`. Specifically:

1. **Missing Timeout on Database Requests**: While `fetchProfile` was updated with a retry and timeout mechanism, the **membership check** for organization users (`supabase.from('organization_members').select(...)`) does not have a timeout. If this request hangs (common on cold starts or network fluctuations), the `initializeAuth` function never completes.
2. **State Deadlock**: `initializeAuth` sets `isResolvingRole` to `true`. Because the function never reaches its `finally` block due to the hanging promise, `isResolvingRole` remains `true` forever.
3. **Navigation Blocked**: The `AuthPage` redirection logic is gated by `isResolvingRole`. If it stays `true`, the `useEffect` returns early and never calls `navigate`.

## Implementation Plan
1. **Add Timeout to Membership Fetch**: Wrap the `organization_members` check in the `withTimeout` helper.
2. **Graceful Fallback**: If the membership check fails or times out, default to a null membership role rather than hanging the entire authentication flow.
3. **Consolidated State Resolution**: Ensure `isResolvingRole` and `isLoading` are set to `false` even if secondary data (like organization membership) fails to load.

## Fixed Files
- `src/contexts/AuthContext.tsx`: Added timeout to membership promise and improved error handling.
- `src/pages/AuthPage.tsx`: Ensured local loading state clears if the auth resolving state finishes.
