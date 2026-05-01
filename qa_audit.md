# HealthPowr — Strict QA / Code Audit (No Mercy)

Scope: repository at `HealthPowr/` (Vite + React + TypeScript + Supabase). This audit prioritizes **security, correctness, and operational risk**. Findings are sorted by **Severity** (Critical → High → Medium → Low).  

> Note: This codebase relies heavily on **client-side Supabase access**; **Row Level Security (RLS)**, constraints, and Edge Function secrets/configuration are part of the real security boundary. If RLS is misconfigured, many “frontend-only” checks become irrelevant.

---

## Critical

---
**File:** `.replit`
**Severity:** Critical
**Category:** Security Vulnerabilities
**Issue:** **Supabase project URL + anon key are hard-coded in a tracked file** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Even though anon keys are “public”, committing environment credentials ties the repo to a specific Supabase project, enables easy abuse, and encourages treating client config as secret-bearing.
**Fix:** Remove these values from `.replit` and load them from the hosting provider’s environment. Rotate the anon key if the project was ever considered private. Add a policy: **no environment values committed** (even public ones) unless intentionally documented.
---

---
**File:** `supabase/functions/verify-admin-passkey/index.ts`
**Severity:** Critical
**Category:** Security Vulnerabilities
**Issue:** CORS is effectively **open by default**: `ALLOWED_ORIGIN` falls back to `"*"`. This allows any website to call the function from a browser. While the passkey still blocks success, this increases attack surface (brute force / enumeration, abuse traffic, noisy logs).
**Fix:** Make `ALLOWED_ORIGIN` **required** (fail closed). Validate the request `Origin` header against an allowlist and return `403` if mismatched. Add rate limiting (Supabase edge + KV, or upstream WAF).
---

---
**File:** `supabase/functions/create-staff-account/index.ts`
**Severity:** Critical
**Category:** Security Vulnerabilities
**Issue:** CORS is effectively **open by default** (`ALLOWED_ORIGIN` defaults to `"*"`), and the function is privileged (service role). If the caller’s JWT is stolen, an attacker can create staff accounts and trigger outbound email.
**Fix:** Fail closed when `ALLOWED_ORIGIN` is missing; validate `Origin` strictly. Consider enforcing additional server-side checks (e.g., only allow from production domain(s), require re-auth, require admin role + MFA, add request rate limits, add audit logging).
---

---
**File:** `supabase/functions/setup-organization/index.ts`
**Severity:** Critical
**Category:** Security Vulnerabilities
**Issue:** CORS is effectively **open by default** (`ALLOWED_ORIGIN` defaults to `"*"`). This function uses service role and mutates `profiles`, `organizations`, `organization_members`. If caller JWT is compromised, attacker can create org records/memberships.
**Fix:** Same as above: fail closed on `ALLOWED_ORIGIN`, validate `Origin`, add throttling + audit logging, and consider requiring a one-time onboarding token rather than any valid session.
---

---
**File:** `supabase/functions/suspend-user/index.ts`
**Severity:** Critical
**Category:** Security Vulnerabilities
**Issue:** CORS is effectively **open by default** (`ALLOWED_ORIGIN` defaults to `"*"`). This function is highly privileged (can update auth users + profile flags). If an admin JWT is compromised, cross-origin requests become easy to weaponize.
**Fix:** Fail closed on `ALLOWED_ORIGIN`, validate `Origin`, add rate limiting, add detailed audit logs (actor, target, previous state), and consider requiring step-up auth.
---

---
**File:** `src/routes/RequireAuth.tsx`
**Severity:** Critical
**Category:** Security Vulnerabilities
**Issue:** Admin “passkey” protection is **not a real security control** once an admin session exists. The passkey check only runs when `!user` (unauthenticated). Any authenticated admin bypasses passkey entirely, and a compromised admin account gets full access without passkey.
**Fix:** If the passkey is intended as a second factor, enforce it **for authenticated admins too** (e.g., require a short-lived server-issued proof stored in secure storage and re-validated periodically; or remove the passkey UX and rely on proper auth controls like MFA + RLS).
---

---
**File:** `.env` (local file)
**Severity:** Critical
**Category:** Security Vulnerabilities
**Issue:** `SUPABASE_SERVICE_ROLE_KEY` is present in `.env`. Even if `.env` is gitignored, keeping service-role keys in developer `.env` files is a high-risk habit (accidental exfiltration via screenshots, logs, backups, or misconfigured tooling).
**Fix:** Remove service role keys from `.env` entirely. Store them only in Supabase Function Secrets / secure vaults. Rotate the leaked service role key immediately if it has ever been shared or committed elsewhere.
---

---
**File:** `src/contexts/AuthContext.tsx`
**Severity:** Critical
**Category:** Bugs & Logic Errors
**Issue:** Role resolution can degrade to **stale user metadata** if profile fetch times out (`withTimeout` returns `null`). The app blocks routing while resolving role, but a timeout may still set `isResolvingRole=false` and allow routing using **metadata fallback**, creating wrong-portal routing and potentially exposing UI routes based on stale role.
**Fix:** Treat profile fetch failures/timeouts as hard failures for privileged roles: retry with backoff, show a blocking error state, or require server-verified role claims. At minimum, do not allow falling back from DB role → metadata role for admin routing.
---

---
**File:** `src/components/**` and `src/api/**` (repo-wide)
**Severity:** Critical
**Category:** Bugs & Logic Errors
**Issue:** The repo contains **duplicate file paths** with mixed separators (e.g. `src/api/messages.ts` and `src\api\messages.ts` appear in status). On Windows this can mask duplicates; in CI/Unix it can cause build, import resolution, or deployment mismatches and “it works on my machine” failures.
**Fix:** Deduplicate and normalize paths. Enforce via lint/CI: case-sensitivity + path-separator checks (e.g., a script that fails build if duplicate logical paths exist).
---

---
**File:** `src/components/staff/StaffOverview.tsx`
**Severity:** Critical
**Category:** Security Vulnerabilities
**Issue:** Uses `dangerouslySetInnerHTML` with dynamic values (`item.text`, and tab HTML strings). If any of this content is sourced from Supabase/user input (even indirectly), this is a **stored XSS** risk (credential theft, token exfiltration, staff/admin takeover).
**Fix:** Remove `dangerouslySetInnerHTML` unless absolutely necessary. Render as plain text, or sanitize with a robust HTML sanitizer (DOMPurify with a strict allowlist) and store only sanitized content. Prefer Markdown rendering with a safe renderer and a restricted subset.
---

## High

---
**File:** `vite.config.ts`
**Severity:** High
**Category:** Security Vulnerabilities
**Issue:** Dev server is configured with `host: "0.0.0.0"` and `allowedHosts: true`, which disables host protections and exposes the dev server broadly on the network.
**Fix:** Default to localhost; restrict `allowedHosts` explicitly; gate LAN hosting behind an env flag for controlled environments only.
---

---
**File:** `supabase/functions/create-staff-account/index.ts`
**Severity:** High
**Category:** Security Vulnerabilities
**Issue:** `generateTempPassword()` shuffles with `Math.random()`, weakening password entropy characteristics (non-cryptographic PRNG). While the characters are initially crypto-random, the shuffle step is not.
**Fix:** Use a crypto-based shuffle (Fisher–Yates using `crypto.getRandomValues`) or skip shuffle entirely by generating in a randomized order with cryptographic randomness.
---

---
**File:** `src/components/client/MessagesView.tsx`
**Severity:** High
**Category:** Type Safety
**Issue:** Extensive use of `any[]` for `conversations` and `messages` defeats TypeScript safety and makes null/shape errors likely (e.g., `conversation.request?.assigned_staff_id`, `conversation.organization?.logo_url`).
**Fix:** Define DTO types that match Supabase selects and use them end-to-end. Use discriminated unions for conversation types and optional joins.
---

---
**File:** `src/api/messages.ts`
**Severity:** High
**Category:** API & Data Layer
**Issue:** `getMyConversations()` orders by `created_at` because `last_message_at` ordering “would require a field in conversations”, yet the select includes `last_message:messages(content, created_at)` without a deterministic rule. This can produce confusing ordering and inconsistent “last message” displays.
**Fix:** Add/maintain `conversations.last_message_at` via trigger, or query messages separately (or via RPC) to compute last message deterministically. Ensure proper indexes.
---

---
**File:** `src/api/requests.ts`
**Severity:** High
**Category:** API & Data Layer
**Issue:** Many list queries use `.limit(200)` or no limit at all (e.g., `getOrgServiceRequests()` has no `.limit`). This is a scaling hazard and can cause slow pages and high Supabase egress costs.
**Fix:** Implement pagination (cursor or offset/range), apply strict defaults (e.g., 50), and add UI pagination/infinite scrolling. Add server-side indexes on common filter columns (`assigned_org_id`, `assigned_staff_id`, `status`, `created_at`, `borough`).
---

---
**File:** `src/components/client/CommunityView.tsx`
**Severity:** High
**Category:** Performance Issues
**Issue:** Single **God component** (~1000+ lines) with inline CSS string injection, many inline SVG icon components, and likely large stateful UI. This increases bundle size, slows parsing, and makes renders expensive/hard to reason about.
**Fix:** Split into subcomponents by feature (Announcements, Forum, CommentPanel, Filters). Move CSS to proper stylesheet/Tailwind classes. Replace inline SVG components with `lucide-react` or a centralized icon module.
---

---
**File:** `src/components/client/CommunityView.tsx`
**Severity:** High
**Category:** Security Vulnerabilities
**Issue:** Inline CSS includes `@import` of Google Fonts inside a runtime style string. This can violate CSP, adds third-party dependency at runtime, and can leak metadata to Google in restricted environments.
**Fix:** Load fonts via static `index.html` or self-host fonts. Enforce CSP and avoid runtime `@import`.
---

---
**File:** `src/contexts/AuthContext.tsx`
**Severity:** High
**Category:** Code Quality
**Issue:** Multiple `catch {}` blocks swallow critical errors (session init, profile fetch, org bootstrap). This makes production debugging extremely difficult and can mask auth integrity failures.
**Fix:** Emit structured, privacy-safe errors to a telemetry sink (Sentry) and surface user-friendly blocking states for auth failures.
---

---
**File:** `src/pages/AuthPage.tsx`
**Severity:** High
**Category:** Bugs & Logic Errors
**Issue:** Signup role handling maps `staff` to `community_member` (`role: (role === 'staff' || role === 'community_member') ? 'community_member' : 'organization'`). This is confusing and likely incorrect: staff accounts appear to be provisioned via Edge Function, not self-signup.
**Fix:** Remove “staff” from self-signup entirely (or route to staff invite flow). Make role selection explicit and consistent with backend membership model.
---

---
**File:** `src/pages/AdminLoginPage.tsx`
**Severity:** High
**Category:** Bugs & Logic Errors
**Issue:** After `signIn`, the page immediately `navigate('/admin')` even though the rest of the app intentionally blocks routing until DB role resolves (to avoid admin→client misroutes). This page can reintroduce the race it tries to avoid.
**Fix:** Wait for `profile.role === 'admin'` before navigating; do not navigate immediately after `signIn`.
---

---
**File:** `src/api/staff.ts`
**Severity:** High
**Category:** Security Vulnerabilities
**Issue:** Sends bearer access token to Edge Function. If the frontend has any XSS, the token can be stolen and used to create staff accounts.
**Fix:** Harden against XSS (CSP, sanitize HTML, avoid dangerouslySetInnerHTML), minimize token exposure, and consider server-side step-up checks (re-auth/MFA) before provisioning staff.
---

---
**File:** `src/api/messages.ts` and `src/api/forum.ts` (and similar API modules)
**Severity:** High
**Category:** Bugs & Logic Errors
**Issue:** Multiple API calls assume authentication (`user!.id`) and will hard-crash if invoked without a session or during session transitions.
**Fix:** Add a shared `requireUser()` helper that throws a controlled error; enforce guards in UI before calling; avoid `!` non-null assertions in the data layer.
---

---
**File:** `src/components/admin/AdminAnnouncementsView.tsx`
**Severity:** High
**Category:** API & Data Layer
**Issue:** Admin announcements CRUD does not handle Supabase errors (most operations ignore `error`) and assumes RLS will fully protect operations. This can lead to silent failures and confusing admin UX; if RLS is misconfigured, it can become a privilege escalation path.
**Fix:** Check and handle `error` for every Supabase call; show actionable UI errors. Add server-side enforcement (RLS policies that restrict insert/update/delete to admins only). Consider moving privileged writes to Edge Functions with explicit role checks.
---

---
**File:** `src/components/admin/AdminAnnouncementsView.tsx`
**Severity:** High
**Category:** Security Vulnerabilities
**Issue:** Uploads arbitrary files to Supabase Storage (`community` bucket) with no client-side validation (type/size) and no server-side checks visible here. If the bucket is public and content is rendered later, this can enable abuse (malware hosting, tracking pixels, large-cost uploads).
**Fix:** Enforce Storage policies (only admins; only image MIME types; max size). Validate file type/size client-side and re-check server-side. Prefer signed uploads or an Edge Function that validates then stores.
---

## Medium

---
**File:** `src/components/cbo/CBOMessagesView.tsx`
**Severity:** Medium
**Category:** Performance Issues
**Issue:** N+1 queries and aggressive polling patterns can cause high DB load and sluggish UX (conversation enrichment done via additional per-item fetches; polling even when realtime is enabled).
**Fix:** Fetch required fields via join/view/RPC in a single request. Reduce polling; rely on realtime + occasional refetch with exponential backoff.
---

---
**File:** `src/components/staff/StaffOverview.tsx`
**Severity:** Medium
**Category:** API & Data Layer
**Issue:** Queries that build large ID lists and then use `.in('request_id', requestIds)` can hit query/URL limits and become slow at scale.
**Fix:** Replace with join-based queries filtered server-side (e.g., filter directly by `assigned_staff_id`) or an RPC that returns a combined feed.
---

---
**File:** `src/api/services.ts` and `src/api/organizations.ts`
**Severity:** Medium
**Category:** Security Vulnerabilities
**Issue:** “Public” reads depend on RLS being permissive enough to work and restrictive enough to prevent leakage. Schema expansion later can accidentally expose new sensitive fields.
**Fix:** Create dedicated “public” views exposing only safe columns and lock anon access to those views.
---

---
**File:** `eslint.config.js`
**Severity:** Medium
**Category:** Type Safety
**Issue:** Lint configuration is not effectively preventing risky patterns; the codebase contains pervasive `any`, non-null assertions, and weak effect dependency discipline.
**Fix:** Tighten lint rules incrementally (warn → error), starting with `src/api/*`, auth/routing, and realtime subscription code; enforce in CI.
---

---
**File:** `src/components/client/MessagesView.tsx`
**Severity:** Medium
**Category:** Performance Issues
**Issue:** Realtime message handler resorts the entire message list on every insert (`next.sort(...)`). This is \(O(n \log n)\) per message and becomes expensive for long threads.
**Fix:** Append in order when possible (compare timestamps), or maintain a keyed map and only insert at correct index. Paginate messages (load last N, fetch older on scroll).
---

---
**File:** `src/components/client/MessagesView.tsx`
**Severity:** Medium
**Category:** UI/UX Issues
**Issue:** The “Search conversations...” input is non-functional (no state, no filtering). This is misleading UI.
**Fix:** Wire to state + filter logic (debounced) or remove the input until implemented.
---

---
**File:** `src/components/client/MessagesView.tsx`
**Severity:** Medium
**Category:** UI/UX Issues
**Issue:** Error recovery uses `window.location.reload()` which is heavy-handed and can lose user context.
**Fix:** Provide a retry button that re-runs the query and preserves state; optionally add offline/reconnect handling.
---

---
**File:** `src/lib/supabase.ts`
**Severity:** Medium
**Category:** Code Quality
**Issue:** If env vars are missing, it constructs a Supabase client with empty strings and only logs a warning. This can cause cascading runtime failures and misleading errors.
**Fix:** Fail fast in development (throw) and render a clear configuration error screen in production builds.
---

---
**File:** `src/api/forum.ts`
**Severity:** Medium
**Category:** API & Data Layer
**Issue:** `getThreads()` fetches `comments:forum_comments(id)` just to compute count, which can be heavy and unindexed at scale.
**Fix:** Store a denormalized `comment_count` on `forum_threads` updated by trigger, or use a `count(*)` aggregate (RPC or PostgREST count).
---

---
**File:** `src/api/organizations.ts`
**Severity:** Medium
**Category:** API & Data Layer
**Issue:** Admin org list uses `.limit(100)` with no pagination. At scale, the UI will be incomplete and admins can’t reach older orgs.
**Fix:** Add pagination + sorting controls; index `organizations.created_at`.
---

---
**File:** `scripts/import-orgs.mjs`
**Severity:** Medium
**Category:** Code Quality
**Issue:** Multiple untyped functions + silent `catch {}` in geocoding. Also hard-coded 1.2s sleeps and no resume checkpointing; partial runs are hard to recover safely.
**Fix:** Add structured logging, explicit error handling, and persist progress (e.g., to a file) to resume. Add typing (TS) if maintained long-term.
---

---
**File:** `src/contexts/NotificationContext.tsx`
**Severity:** Medium
**Category:** UI/UX Issues
**Issue:** Notifications are persisted indefinitely in `localStorage` without TTL, size caps, or pruning. This can grow and degrade performance.
**Fix:** Add max length (e.g., 200) + TTL-based pruning on load/save.
---

---
**File:** `src/pages/AuthCallbackPage.tsx`
**Severity:** Medium
**Category:** Security Vulnerabilities
**Issue:** Return-to handling allows any internal path that starts with `/`. While it blocks `//`, it still allows redirects to sensitive internal routes without additional validation (phishing-within-app patterns).
**Fix:** Allowlist return destinations by route group, or only redirect to known safe portals. Consider storing intended returnTo in session rather than trusting URL params.
---

---
**File:** `src/components/admin/AdminDashboard.tsx`
**Severity:** Medium
**Category:** Code Quality
**Issue:** Mixed sources of truth for authorization (“Admin Authorization Verified” UI label) without actual runtime verification beyond client-side role checks.
**Fix:** Ensure privileged actions are enforced server-side (RLS/Edge Functions). Rename UI copy to avoid implying stronger guarantees than exist.
---

## Low

---
**File:** `src/components/landing/AuthNudgeModal.tsx`, `src/components/client/CommunityView.tsx`, `src/components/client/ApplicationsView.tsx` (and similar UI)
**Severity:** Low
**Category:** UI/UX Issues
**Issue:** Clickable containers implemented as `<div onClick>` without keyboard semantics can break accessibility (no tab focus, no Enter/Space activation, missing ARIA labels).
**Fix:** Use semantic `<button type="button">` elements for actions, or add `role="button"`, `tabIndex={0}`, and key handlers. Run axe audits and keyboard-only QA.
---

---
**File:** `src/components/client/MessagesView.tsx`
**Severity:** Low
**Category:** Type Safety
**Issue:** Non-null assertions (`selectedConversationId!`, `user!.id` in API) increase crash risk if invariants break.
**Fix:** Replace with explicit guards and early returns; make API functions accept the needed IDs rather than calling `getUser()` repeatedly.
---

---
**File:** `src/api/auth.ts`
**Severity:** Low
**Category:** Performance Issues
**Issue:** Module-level in-memory profile cache may cause surprising behavior across tabs/windows and complicate debugging stale profile issues.
**Fix:** Either rely on React Query caching or make cache behavior explicit and observable (cache key, TTL, manual invalidation).
---

---
**File:** `src/components/client/CommunityView.tsx`
**Severity:** Low
**Category:** UI/UX Issues
**Issue:** Large amount of custom inline UI (icons, CSS) increases accessibility risk (missing aria labels, focus management, keyboard navigation) and maintenance burden.
**Fix:** Standardize on shared UI components and run accessibility tooling (axe) with keyboard-only QA.
---

---
**File:** Repo-wide
**Severity:** Low
**Category:** Testing
**Issue:** No tests found (no `__tests__`, `vitest`, `jest`, or `cypress` configs). Critical flows (auth, role gating, request lifecycle, messaging realtime) have zero automated coverage.
**Fix:** Add a baseline test pyramid:
- Unit tests (Vitest) for pure utilities and API helpers
- Component tests (React Testing Library) for auth + routing guards
- E2E (Playwright/Cypress) for login, request submission, assignment, messaging, admin org approval
---

