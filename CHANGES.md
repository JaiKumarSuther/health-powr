# HealthPowr — Change Log (Work Session)

This file documents the full set of changes made during the QA-audit remediation pass (security/perf/type-safety/UX).  
It is intentionally **large and exhaustive** and is organized for code review and future archaeology.

> Note: Some items below reference new Supabase migrations/functions. Applying DB changes requires running migrations in your Supabase project and ensuring RLS + indexes align with the new access patterns.

---

## Verification (run after changes)

- **Typecheck**: `npx tsc --noEmit` ✅
- **Lint**: `npx eslint src/ --max-warnings 0` ✅
- **Build**: `npm run build` ✅ (Vite production build succeeded)

---

## Security & Secrets Hygiene

### Removed hard-coded credentials
- **`.replit`**
  - Removed hard-coded `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
  - Replaced with explicit guidance to configure via `.env` / deployment env.

### Prevented accidental secret commits
- **`.gitignore`**
  - Explicitly ignores `.replit` (replit configs can embed secrets).
  - Ensures local `.env` stays untracked.

### Admin passkey hardening (server-issued proof token)
- **`supabase/functions/verify-admin-passkey/index.ts`**
  - Implemented strict origin validation (fail closed).
  - Implemented short-lived **HMAC-signed proof token** issuance + verification.
  - Avoids “sticky boolean” authorization stored client-side.
- **`src/pages/AdminPasskeyPage.tsx`**
  - Stores `hp_admin_passkey_proof` + expiry (instead of `hp_admin_passkey_ok`).
- **`src/routes/RequireAuth.tsx`**
  - Verifies proof token for admin access and redirects to `/admin-passkey` when missing/invalid/expired.
  - Adds explicit loading state while verifying admin proof (prevents UI flash / race).

### Edge Function CORS hardening (applied consistently)
All hardened to:
- Require `ALLOWED_ORIGIN` secret (fail closed if missing).
- Validate `Origin` header against allowlist.
- Correctly handle OPTIONS preflight.

Files:
- **`supabase/functions/create-staff-account/index.ts`**
- **`supabase/functions/setup-organization/index.ts`**
- **`supabase/functions/suspend-user/index.ts`**
- **`supabase/functions/verify-admin-passkey/index.ts`**

---

## Authentication & Role Resolution

### Auth error surfacing (no silent failure)
- **`src/contexts/AuthContext.tsx`**
  - Replaced remaining `catch {}` blocks with `console.error(...)` so failures are diagnosable.
  - Kept org-bootstrap failures **non-blocking**, but now logged without leaking user-provided org details.
  - Preserves the “admin role must be confirmed by DB profile” policy (no metadata-only admin).

### Removed module-level profile cache
- **`src/api/auth.ts`**
  - Removed module-level `profileCache` Map and TTL behavior.
  - `fetchProfile()` now always queries Supabase (callers control when/how often).
  - Keeps existing error/warn logging for missing row / RLS failures.

---

## Messaging (Client, CBO, Realtime, Performance)

### Messages pagination + insert optimization
- **`src/api/messages.ts`**
  - `getMessages(conversationId, opts)` now supports:
    - `limit` (default 50, clamped to 1..200)
    - `beforeCreatedAt` for “load older”
  - Query uses descending order + `limit` then reverses client-side for chronological display.

- **`src/components/client/MessagesView.tsx`**
  - Added **“Load older”** control for messages.
  - Realtime INSERT handler optimized:
    - Fast-path append when message is in-order.
    - Sort only on rare out-of-order inserts.
  - Conversation search input now actually filters list (no dead input).
  - Replaced `onKeyPress` with `onKeyDown` for Enter-to-send correctness.

### CBO Messages: removed N+1 and polling
- **`src/api/messages.ts`**
  - `getMyOrgConversations()` selection expanded so the conversation list already contains request metadata and assigned staff.
- **`src/components/cbo/CBOMessagesView.tsx`**
  - Removed per-conversation N+1 enrichment query to `service_requests`.
  - Disabled aggressive polling loop; now relies on realtime + explicit fetch on mount/selection.
  - Realtime insert handler uses same append/sort strategy as client messages.

---

## Service Requests (Pagination + Query Scalability)

### API pagination via `.range(from,to)` (default page size 50)
- **`src/api/requests.ts`**
  - Added helpers:
    - `pageRange({ page, pageSize })`
    - `clampPageSize(pageSize)` (1..200, default 50)
  - Added pagination to:
    - `getMyRequests(opts)`
    - `getOrgRequests(filters, opts)`
    - `getOrgServiceRequests(filters, opts)`
    - `getAllRequests(filters, opts)`
    - `exportCsv(opts)` (paged export support)

### Removed “fetch all request IDs then `.in()`” anti-pattern
- **`src/api/requests.ts`**
  - `getOrgTeamActivity()` now filters activity using **join-based server-side filtering**:
    - `request_notes` joined to `service_requests!inner(...)` filtered by `assigned_org_id`
    - `request_status_history` joined to `service_requests!inner(...)` filtered by `assigned_org_id`
  - This avoids:
    - Unbounded request-id lists
    - Query size blowups
    - Poor performance on large orgs

---

## Admin Requests UI + CSV Export Correctness

### Admin list now paginated
- **`src/components/admin/RequestsListView.tsx`**
  - Requests list now fetches by page (page size 50).
  - Added “Next page” button, disabled when results < page size.

### CSV export now complete (paged)
- **`src/components/admin/RequestsListView.tsx`**
- **`src/components/admin/ReportsView.tsx`**
  - Export pages through results in chunks (500/page) until exhausted.
  - Prevents silent truncation when API pagination is enabled.

---

## Community View (Removal of Runtime CSS Injection & Font Injection)

### Moved Inter font loading to document head
- **`index.html`**
  - Added `preconnect` + stylesheet link for Inter.

### Removed runtime font injection
- **`src/components/client/CommunityView.tsx`**
  - Removed `useEffect()` that injected a `<link>` into `document.head`.

### Removed runtime `<style>{CSS}</style>` injection
- **`src/components/client/CommunityView.tsx`**
  - Removed giant `const CSS = \`...\`` and `<style>{CSS}</style>`.
- **`src/components/client/CommunityView.css`** (new)
  - Extracted CommunityView styles into a static stylesheet imported by the component.

> This reduces hydration/layout hazards, removes network side effects from component mount, and makes CSS reviewable/diffable.

---

## Forum performance improvements

### Denormalized comment count
- **`supabase/migrations/049_add_forum_thread_comment_count.sql`** (new)
  - Adds `forum_threads.comment_count`
  - Adds triggers to keep it updated on insert/delete/moderation changes.
- **`src/api/forum.ts`**
  - `getThreads()` now reads `comment_count` directly (removes expensive “fetch all comment ids and count” behavior).

---

## Conversations ordering correctness

### Added deterministic `last_message_at`
- **`supabase/migrations/048_add_conversations_last_message_at.sql`** (new)
  - Adds `conversations.last_message_at`
  - Backfills from existing messages
  - Adds trigger to update on message insert
  - Adds index for ordering
- **`src/api/messages.ts`**
  - Conversation list ordering uses `last_message_at` then `created_at`.

---

## Environment configuration UX

### Clear configuration error screen
- **`src/lib/supabase.ts`**
  - Exposes `isSupabaseConfigured`
  - Dev: fail fast when config missing
  - Prod: logs and renders friendly error screen
- **`src/components/shared/ConfigurationError.tsx`** (new)
- **`src/App.tsx`**
  - Renders `<ConfigurationError />` when Supabase env is missing.

---

## Notifications persistence safety

- **`src/contexts/NotificationContext.tsx`**
  - Added retention policy:
    - TTL pruning (30 days)
    - Max notifications cap (200)
  - Prevents unbounded localStorage growth and performance degradation.

---

## Signup / Role / Redirect Safety

- **`src/pages/AuthPage.tsx`**
  - Removed “staff” from self-signup (staff accounts are provisioned separately).
- **`src/pages/AuthCallbackPage.tsx`**
  - `returnTo` now allowlisted to portal roots only (prevents open redirect).
- **`src/pages/AdminLoginPage.tsx`**
  - Added “wait for confirmed admin role” flow to avoid navigation race.

---

## Admin announcements robustness

- **`src/components/admin/AdminAnnouncementsView.tsx`**
  - Added consistent read/write error handling (`actionError` banner).
  - Added client-side upload validation:
    - allowed image types (JPG/PNG/WebP)
    - max size (5MB)

---

## New utilities and tooling

### Auth utility to enforce session presence
- **`src/api/requireUser.ts`** (new)
  - `requireUser()` throws a typed `AuthError` when missing session/user.
  - Used to remove unsafe `user!.id` usages in API modules.

### Duplicate-path detection (Windows/macOS/Linux safety)
- **`scripts/check-duplicate-paths.mjs`** (new)
- **`package.json`**
  - Added `check:paths` script.

---

## Requesting/Staff views (as introduced/updated in this pass)

- **`src/components/staff/StaffMessagesView.tsx`** (new)
- **`src/pages/staff/StaffMessagesPage.tsx`**
- **`src/components/staff/StaffOverview.tsx`**
  - Removed `dangerouslySetInnerHTML` to prevent XSS.
- **`src/components/staff/StaffOverviewView.tsx`**
  - Wiring updates to match staff view changes.

---

## Vite dev server exposure policy

- **`vite.config.ts`**
  - Default host is local-only.
  - LAN exposure requires explicit env opt-in.
  - Removed permissive `allowedHosts: true` behavior.

---

## File index (touched/added in this session)

### Added
- `CHANGES.md`
- `qa_audit.md`
- `scripts/check-duplicate-paths.mjs`
- `src/api/requireUser.ts`
- `src/components/client/CommunityView.css`
- `src/components/shared/ConfigurationError.tsx`
- `src/components/staff/StaffMessagesView.tsx`
- `supabase/migrations/048_add_conversations_last_message_at.sql`
- `supabase/migrations/049_add_forum_thread_comment_count.sql`

### Modified (selection—high signal)
- `.env.example`
- `.gitignore`
- `.replit`
- `README.md`
- `index.html`
- `package.json`
- `src/App.tsx`
- `src/api/auth.ts`
- `src/api/forum.ts`
- `src/api/messages.ts`
- `src/api/organizations.ts`
- `src/api/requests.ts`
- `src/components/admin/AdminAnnouncementsView.tsx`
- `src/components/admin/ReportsView.tsx`
- `src/components/admin/RequestsListView.tsx`
- `src/components/cbo/CBOMessagesView.tsx`
- `src/components/client/ApplicationsView.tsx`
- `src/components/client/CommunityView.tsx`
- `src/components/client/MessagesView.tsx`
- `src/components/staff/StaffOverview.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/NotificationContext.tsx`
- `src/lib/supabase.ts`
- `src/lib/types.ts`
- `src/pages/AdminLoginPage.tsx`
- `src/pages/AdminPasskeyPage.tsx`
- `src/pages/AuthCallbackPage.tsx`
- `src/pages/AuthPage.tsx`
- `src/pages/staff/StaffMessagesPage.tsx`
- `src/routes/RequireAuth.tsx`
- `supabase/functions/create-staff-account/index.ts`
- `supabase/functions/setup-organization/index.ts`
- `supabase/functions/suspend-user/index.ts`
- `supabase/functions/verify-admin-passkey/index.ts`
- `vite.config.ts`

---

## Known remaining backlog (not implemented here)

These were intentionally left as follow-ups:
- **ESLint tightening** (`med-28-eslint-tighten`): converting warnings to errors / stricter ruleset.
- **A11y div-onClick → button semantics** (`low-29-a11y-div-click`): keyboard/ARIA correctness in remaining hotspots.
- **Test scaffolding** (`low-31-tests`): Vitest/RTL + Playwright wiring and CI integration.

