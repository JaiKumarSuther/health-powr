![CI](https://github.com/YOUR_ORG/HealthPowr/actions/workflows/ci.yml/badge.svg)

## HealthPowr (FixHealth)

Role-based web app that connects **community members** to **verified community-based organizations (CBOs)** for services (housing, food, healthcare, etc.), with **request tracking** and **secure messaging** between clients and assigned org staff. Admin tooling supports onboarding/moderation and operational reporting.

---

## What the app does (core purpose)
- **For community members (clients)**: browse verified organizations/services (map + filters), submit service requests, track request status/history, and message the assigned org team.
- **For organizations (CBOs)**: manage incoming requests, triage/assign to staff, update statuses, add internal notes, and communicate with clients.
- **For staff**: handle only the requests/conversations assigned to them; internal org messaging supports team coordination.
- **For admins**: approve/reject organizations, view/export requests, manage users, and publish announcements; admin portal is protected by an additional passkey gate.

Value proposition: **faster, accountable access to support** by routing requests to organizations, keeping an auditable timeline (status history + notes), and reducing coordination friction via realtime messaging.

---

## Tech stack
- **Frontend**: React 18 + TypeScript, Vite, React Router
- **State / data fetching**: TanStack React Query (configured for low-refetch UX: no refetch-on-focus/mount, 5m staleTime)
- **Styling / UI**: Tailwind CSS (+ `tailwind-merge`), `lucide-react` icons, `framer-motion` animations
- **Maps & charts**: Leaflet + React Leaflet, Recharts
- **Backend / APIs**: Supabase
  - **Auth**: Supabase Auth (email/password + email verification + PKCE callback exchange)
  - **Database**: Supabase Postgres (accessed directly from the client via `@supabase/supabase-js` + Row Level Security)
  - **Realtime**: Supabase Realtime (Postgres changes subscriptions for messaging)
  - **Serverless**: Supabase Edge Functions for privileged operations (see below)

There is no separate custom backend server in this repo; the client talks to Supabase directly.

---

## Key features & modules (high-level)
- **Authentication & role routing**
  - Single app with role-gated portals: `/client`, `/cbo`, `/staff`, `/admin`
  - Strict role enforcement via `RequireAuth` (redirects users to their correct portal)
  - Admin additionally requires a verified passkey before showing the admin login page
- **Organizations & services directory**
  - Approved org browsing + map view (org geo fields supported)
  - Public services feed (`services` joined with `organizations`)
- **Service requests workflow**
  - Client request creation with auto-assignment logic (prefer service owner org; otherwise best-effort borough routing)
  - CBO/staff request queues (filters by status/category; staff sees assigned-only)
  - Status updates with an append-only **status history** + **internal notes**
  - Assignment controls restricted to org owner/admin roles
  - Admin global request visibility + CSV export + status counts
- **Messaging**
  - Client ↔ organization conversations tied to service requests
  - Org staff visibility scoped by membership role and assignment
  - Realtime updates via `postgres_changes` subscriptions
  - Internal org messaging (direct/group) via conversation participants
- **Community forum**
  - Threads + comments with basic moderation flags
- **Notifications**
  - Client-side notification center persisted in `localStorage` (`hp_notifications_v1`)

---

## Project structure (selected)
- `src/App.tsx`: router + lazy-loaded portals + auth/notification providers
- `src/main.tsx`: React Query client configuration + app bootstrap
- `src/contexts/`
  - `AuthContext.tsx`: session bootstrap, profile fetch, role resolution, org bootstrap triggers
  - `NotificationContext.tsx`: persistent in-app notifications
- `src/routes/RequireAuth.tsx`: route guard + strict role redirects + admin passkey flow
- `src/pages/`: auth/login/callback pages (including admin passkey flow)
- `src/components/`
  - `client/`: community member portal (services, requests, messages, community forum)
  - `cbo/`: organization portal (requests, clients, services, internal messaging, reports, settings)
  - `staff/`: staff-facing dashboard/views (assigned work focus)
  - `admin/`: admin portal (org approvals, users, requests, reports, announcements)
  - `landing/`: marketing/landing experience
  - `shared/` and `ui/`: shared UI primitives
- `src/api/`: thin data-access layer over Supabase tables/functions (requests, orgs, messages, staff provisioning, forum, auth helpers)
- `src/lib/`: Supabase client initialization + shared utilities/types

---

## Environment setup
### Prerequisites
- Node.js + npm
- A Supabase project with the expected tables/RLS policies and Edge Functions deployed (see below)

### Install & run
```bash
npm install
npm run dev
```
Vite dev server runs on **port 5000** by default.

### Required environment variables
Create a local `.env` (do **not** commit secrets) with at least:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL` (e.g. `http://localhost:5000/`)

### Server-only secrets (Edge Functions)
These must be configured as **Supabase Function Secrets** (never `VITE_` prefixed):
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSKEY`
- `ALLOWED_ORIGIN`

---

## Supabase architecture notes (important for QA)
- **DB-first role truth**: UI blocks routing until the profile is loaded from the `profiles` table to avoid “portal flash” and stale role issues.
- **Role model**:
  - App roles: `community_member`, `organization`, `admin`
  - Org membership roles (in `organization_members`): `owner`, `admin`, `member` (used to scope request/conversation access)
- **Edge Functions used by the client** (by convention at `/functions/v1/<name>`):
  - `setup-organization`: bootstrap an org for a newly created org-owner account
  - `verify-admin-passkey`: gate admin entry before allowing admin login UI
  - `create-staff-account`: privileged staff provisioning (requires bearer token + server secrets)
- **Realtime**: messaging subscribes to inserts on `messages` filtered by `conversation_id`.

---

## Notable design decisions
- **No separate backend**: most reads/writes go directly from the client to Supabase; correctness depends heavily on **RLS policies** and table constraints.
- **Reduced refetch churn**: React Query defaults are tuned to avoid refetch-on-mount/focus; mutations should explicitly invalidate queries.
- **Security layering for admin**: admin routes require both auth + a passkey verified through an Edge Function (stored per-tab in `sessionStorage`).

---

## QA / CI checks
Run these locally before opening a PR:

```bash
npm run lint:ci
npm test
```

E2E (intended to run against staging; requires real Supabase backend + seeded test accounts/data):

```bash
# optional: install browsers on a fresh machine/CI runner
npx playwright install --with-deps

# run e2e (globalSetup will seed users/data + create storageState)
E2E_APP_BASE_URL="https://your-staging-host" \
E2E_SUPABASE_URL="https://<ref>.supabase.co" \
E2E_SUPABASE_ANON_KEY="..." \
E2E_SUPABASE_SERVICE_ROLE_KEY="..." \
E2E_TEST_PASSWORD="Password123!" \
npm run test:e2e
```

---

## E2E Setup (one-time)
1. **Pick a staging Supabase project** (do not run E2E against prod).
2. In that Supabase project, ensure the expected tables exist and RLS allows the app to function for seeded roles.
3. Configure CI secrets (or local env vars) required by the Playwright global seed:
   - `E2E_APP_BASE_URL`: your staging web host (e.g. `https://staging.healthpowr.app`)
   - `E2E_SUPABASE_URL`: your staging Supabase URL (e.g. `https://<ref>.supabase.co`)
   - `E2E_SUPABASE_ANON_KEY`: staging anon key (safe to use client-side)
   - `E2E_SUPABASE_SERVICE_ROLE_KEY`: **service role** key (server-only; needed to seed + teardown)
   - `E2E_TEST_PASSWORD`: password used for the seeded test users
4. Run:
   - `npx playwright install --with-deps`
   - `npm run test:e2e`

How it works:
- `e2e/global-setup.ts` seeds users for **client**, **org owner**, **staff (org member)**, and **admin**, plus an org, service, request, conversation, and initial message.
- It then generates per-role Playwright `storageState` files under `.playwright/` so tests start authenticated without UI login.
- `e2e/global-teardown.ts` deletes seeded DB rows and auth users after the run.

