import pg from "pg";
import fs from "node:fs";

const { Client } = pg;

const POLICY_QUERY = `
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
`.trim();

/**
 * Expected access model (human-readable). We compare these expectations against
 * the current policies and produce an audit report + suggested SQL policy snippets.
 *
 * Note: suggested SQL is intentionally conservative; you may need to adapt naming
 * conventions (policy names, helper functions) to match your schema.
 */
const EXPECTED = [
  {
    table: "service_requests",
    expected:
      "Client: own rows only. Org: assigned_org_id match. Staff: assigned_staff_id match. Admin: all.",
  },
  {
    table: "messages",
    expected: "Only users who are participants in the conversation.",
  },
  {
    table: "conversations",
    expected: "Only participants (client or org member).",
  },
  {
    table: "organization_members",
    expected: "Only members of same org; owner can see all members.",
  },
  {
    table: "profiles",
    expected: "Own row for all; admin can read all.",
  },
  {
    table: "organizations",
    expected:
      "Public read for approved; org owner can update own; admin all.",
  },
  {
    table: "forum_threads",
    expected: "Public read; authenticated insert; author or admin can delete.",
  },
  {
    table: "forum_comments",
    expected: "Same as threads.",
  },
  {
    table: "request_status_history",
    expected:
      "Read: request participants. Insert: org/staff only. No update/delete.",
  },
  {
    table: "request_notes",
    expected:
      "Read: org members only. Insert: org/staff only. No client read.",
  },
  {
    table: "org_announcements",
    expected: "Public read; admin insert/update/delete only.",
  },
];

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function mdEscape(s) {
  return String(s ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function groupByTable(rows) {
  const m = new Map();
  for (const r of rows) {
    const key = r.tablename;
    const arr = m.get(key) ?? [];
    arr.push(r);
    m.set(key, arr);
  }
  return m;
}

function renderPolicyRows(rows) {
  if (!rows || rows.length === 0) return "_(none)_";
  return rows
    .map((r) => {
      const roles = Array.isArray(r.roles) ? r.roles.join(",") : String(r.roles ?? "");
      return [
        `- **${r.cmd}** ${r.policyname}`,
        `  - permissive: \`${r.permissive}\``,
        `  - roles: \`${roles}\``,
        `  - qual: \`${mdEscape(r.qual)}\``,
        `  - with_check: \`${mdEscape(r.with_check)}\``,
      ].join("\n");
    })
    .join("\n");
}

function suggestedSql(table) {
  // These are templates; adjust helper function names / columns to match your schema.
  switch (table) {
    case "service_requests":
      return `
-- service_requests (templates)
-- Enable RLS:
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Client read own:
CREATE POLICY "service_requests_select_own"
ON public.service_requests
FOR SELECT
TO authenticated
USING (member_id = auth.uid());

-- Org/staff read assigned:
CREATE POLICY "service_requests_select_assigned_org_or_staff"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  assigned_org_id IN (
    SELECT organization_id FROM public.organization_members om
    WHERE om.profile_id = auth.uid()
  )
  OR assigned_staff_id = auth.uid()
);

-- Admin read all (example; requires DB-truth admin role on profiles):
CREATE POLICY "service_requests_select_admin"
ON public.service_requests
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
`.trim();

    case "conversations":
      return `
-- conversations (templates)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_participants"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  member_id = auth.uid()
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members om
    WHERE om.profile_id = auth.uid()
  )
);
`.trim();

    case "messages":
      return `
-- messages (templates)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_by_conversation_participants"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (
        c.member_id = auth.uid()
        OR c.organization_id IN (
          SELECT organization_id FROM public.organization_members om
          WHERE om.profile_id = auth.uid()
        )
      )
  )
);
`.trim();

    case "organization_members":
      return `
-- organization_members (templates)
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_same_org"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members me
    WHERE me.profile_id = auth.uid()
  )
);
`.trim();

    case "profiles":
      return `
-- profiles (templates)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles_select_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
`.trim();

    case "organizations":
      return `
-- organizations (templates)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Public read approved:
CREATE POLICY "organizations_select_public_approved"
ON public.organizations
FOR SELECT
TO anon, authenticated
USING (status = 'approved' AND is_active = true);

-- Owner update own:
CREATE POLICY "organizations_update_owner"
ON public.organizations
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Admin all:
CREATE POLICY "organizations_all_admin"
ON public.organizations
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
`.trim();

    case "forum_threads":
      return `
-- forum_threads (templates)
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_threads_select_public"
ON public.forum_threads
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "forum_threads_insert_authenticated"
ON public.forum_threads
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

CREATE POLICY "forum_threads_delete_author_or_admin"
ON public.forum_threads
FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
`.trim();

    case "forum_comments":
      return `
-- forum_comments (templates)
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_comments_select_public"
ON public.forum_comments
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "forum_comments_insert_authenticated"
ON public.forum_comments
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

CREATE POLICY "forum_comments_delete_author_or_admin"
ON public.forum_comments
FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
`.trim();

    case "request_status_history":
      return `
-- request_status_history (templates)
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "request_status_history_select_participants"
ON public.request_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.service_requests r
    WHERE r.id = request_status_history.request_id
      AND (
        r.member_id = auth.uid()
        OR r.assigned_staff_id = auth.uid()
        OR r.assigned_org_id IN (
          SELECT organization_id FROM public.organization_members om
          WHERE om.profile_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "request_status_history_insert_org_or_staff"
ON public.request_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.service_requests r
    WHERE r.id = request_status_history.request_id
      AND (
        r.assigned_staff_id = auth.uid()
        OR r.assigned_org_id IN (
          SELECT organization_id FROM public.organization_members om
          WHERE om.profile_id = auth.uid()
        )
      )
  )
);
`.trim();

    case "request_notes":
      return `
-- request_notes (templates)
ALTER TABLE public.request_notes ENABLE ROW LEVEL SECURITY;

-- Read: org members only (no client read)
CREATE POLICY "request_notes_select_org_members"
ON public.request_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.service_requests r
    WHERE r.id = request_notes.request_id
      AND r.assigned_org_id IN (
        SELECT organization_id FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
      )
  )
);

-- Insert: org/staff only
CREATE POLICY "request_notes_insert_org_or_staff"
ON public.request_notes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.service_requests r
    WHERE r.id = request_notes.request_id
      AND (
        r.assigned_staff_id = auth.uid()
        OR r.assigned_org_id IN (
          SELECT organization_id FROM public.organization_members om
          WHERE om.profile_id = auth.uid()
        )
      )
  )
);
`.trim();

    case "org_announcements":
      return `
-- org_announcements (templates)
ALTER TABLE public.org_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_announcements_select_public"
ON public.org_announcements
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "org_announcements_mutate_admin"
ON public.org_announcements
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
`.trim();

    default:
      return `-- No template available for ${table}.`;
  }
}

async function main() {
  const dbUrl =
    env("SUPABASE_DB_URL") ??
    env("E2E_DB_URL") ??
    env("DATABASE_URL");

  if (!dbUrl) {
    console.error(
      [
        "Missing DB connection string.",
        "",
        "Set one of:",
        "- SUPABASE_DB_URL (recommended)",
        "- E2E_DB_URL",
        "- DATABASE_URL",
        "",
        "Then run:",
        "  node scripts/rls-audit.mjs",
      ].join("\n"),
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const res = await client.query(POLICY_QUERY);
  await client.end();

  const rows = res.rows ?? [];
  const byTable = groupByTable(rows);

  const lines = [];
  lines.push(`# Supabase RLS Audit (pg_policies)`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Query:");
  lines.push("");
  lines.push("```sql");
  lines.push(POLICY_QUERY);
  lines.push("```");
  lines.push("");

  lines.push("## Table-by-table audit");
  lines.push("");

  lines.push("| Table | Current policy (from pg_policies) | Expected policy | Status |");
  lines.push("|---|---|---|---|");

  const fixes = [];

  for (const spec of EXPECTED) {
    const current = byTable.get(spec.table) ?? [];
    const status = current.length === 0 ? "MISSING" : "REVIEW";
    // We can't reliably decide MATCH vs MISMATCH without semantic evaluation of qual/with_check,
    // so we produce REVIEW by default and include suggested SQL templates below.
    lines.push(
      `| \`${spec.table}\` | ${mdEscape(renderPolicyRows(current))} | ${mdEscape(spec.expected)} | **${status}** |`,
    );

    if (status !== "MATCH") {
      fixes.push({
        table: spec.table,
        sql: suggestedSql(spec.table),
      });
    }
  }

  lines.push("");
  lines.push("## Suggested SQL fixes (templates)");
  lines.push("");
  lines.push(
    "These are conservative templates. Apply only after confirming your existing RLS policies and helper functions.",
  );
  lines.push("");

  for (const f of fixes) {
    lines.push(`### \`${f.table}\``);
    lines.push("");
    lines.push("```sql");
    lines.push(f.sql);
    lines.push("```");
    lines.push("");
  }

  const outPath = "RLS_AUDIT.md";
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`Wrote ${outPath} (${rows.length} policies scanned).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

