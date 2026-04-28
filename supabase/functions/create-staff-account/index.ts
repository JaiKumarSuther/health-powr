// Supabase Edge Function: create-staff-account
// Owner/admin creates a staff user directly (no invite email required).
// A temporary password is generated and returned to the owner to share securely.
//
// Required secrets (set in Supabase function env, NOT in frontend):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sendStaffCredentialsEmail(input: {
  to: string;
  staffName?: string | null;
  orgName: string;
  loginEmail: string;
  tempPassword: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!apiKey) {
    return {
      attempted: true as const,
      sent: false as const,
      provider: "resend" as const,
      error: "Email delivery is not configured (missing RESEND_API_KEY).",
    };
  }

  const staffPortalUrl = (Deno.env.get("STAFF_PORTAL_URL") || "").trim() || "http://localhost:5000/staff-login";
  const from = (Deno.env.get("RESEND_FROM") || "").trim() || "HealthPowr <onboarding@resend.dev>";

  const subject = `Your ${input.orgName} staff login`;
  const safeName = input.staffName?.trim() || "there";
  const text =
    `Hi ${safeName},\n\n` +
    `You’ve been added as staff for ${input.orgName} on HealthPowr.\n\n` +
    `Staff Portal: ${staffPortalUrl}\n` +
    `Login email: ${input.loginEmail}\n` +
    `Temporary password: ${input.tempPassword}\n\n` +
    `Please sign in and change your password after first login.\n`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        text,
      }),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { attempted: true as const, sent: false as const, provider: "resend" as const, error: "Resend request timed out (10s)." };
    }
    return { attempted: true as const, sent: false as const, provider: "resend" as const, error: e?.message || "Resend request failed." };
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch { /* ignore */ }
    return { attempted: true as const, sent: false as const, provider: "resend" as const, error: body?.message || `Resend failed (${res.status})` };
  }

  return { attempted: true as const, sent: true as const, provider: "resend" as const, error: null as const };
}

function toOrgSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function toStaffLoginEmail(username: string, orgName: string) {
  const u = username.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "");
  const orgSlug = toOrgSlug(orgName) || "org";
  return `${u}@${orgSlug}.healthpowr.app`;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

/** Generates a secure random temporary password: 12 chars, mixed case + digits + symbol. */
function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#!$";
  const all = upper + lower + digits + symbols;
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  let pass = upper[arr[0] % upper.length]
    + lower[arr[1] % lower.length]
    + digits[arr[2] % digits.length]
    + symbols[arr[3] % symbols.length];
  for (let i = 4; i < 12; i++) pass += all[arr[i] % all.length];
  // shuffle
  return pass.split("").sort(() => 0.5 - Math.random()).join("");
}

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": ALLOWED_ORIGIN,
          "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
          "access-control-allow-methods": "POST, OPTIONS",
        },
      });
    }
    if (req.method !== "POST") {
      return json(405, { error: true, message: "Method not allowed" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, {
        error: true,
        message: "Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
      });
    }
    // Hard requirement: do not create staff accounts unless email delivery is configured.
    // This ensures credentials are delivered and avoids orphaned accounts.
    if (!Deno.env.get("RESEND_API_KEY")?.trim()) {
      return json(503, {
        error: true,
        message:
          "Email delivery is not configured. Set RESEND_API_KEY/RESEND_FROM function secrets to enable staff onboarding.",
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json(401, { error: true, message: "Missing Authorization header." });
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json(401, { error: true, message: "Missing bearer token." });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const payload = (await req.json().catch(() => null)) as null | {
      organizationId: string;
      organizationName: string;
      username: string;
      personalEmail: string;
      fullName?: string;
      membershipRole: "admin" | "member";
    };

    if (
      !payload?.organizationId ||
      !payload.organizationName ||
      !payload.username ||
      !payload.personalEmail
    ) {
      return json(400, { error: true, message: "Missing required fields." });
    }

    const personalEmail = payload.personalEmail.trim().toLowerCase();
    const username = normalizeUsername(payload.username);
    const orgName = String(payload.organizationName ?? "").trim();

    if (!isValidEmail(personalEmail)) {
      return json(400, { error: true, message: "Invalid personalEmail. Provide a valid email address." });
    }
    if (!orgName) {
      return json(400, { error: true, message: "Invalid organizationName." });
    }
    if (
      !username ||
      username.length < 3 ||
      username.length > 24 ||
      !/^[a-z0-9._-]+$/.test(username)
    ) {
      return json(400, {
        error: true,
        message: "Invalid username. Use 3-24 chars: a-z, 0-9, dot, underscore, dash.",
      });
    }
    if (payload.membershipRole !== "admin" && payload.membershipRole !== "member") {
      return json(400, { error: true, message: "Invalid membershipRole." });
    }

    // Verify caller is authenticated and is owner/admin of the org
    const { data: caller, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !caller?.user) return json(401, { error: true, message: "Not authenticated." });

    const callerId = caller.user.id;
    const { data: membership, error: membershipErr } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", payload.organizationId)
      .eq("profile_id", callerId)
      .maybeSingle();
    if (membershipErr) return json(500, { error: true, message: `Failed to verify membership. ${membershipErr.message}` });
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return json(403, { error: true, message: "Only org owner/admin can create staff accounts." });
    }

    // Ensure username is unique within the org
    const { data: existingU, error: existingUErr } = await admin
      .from("organization_members")
      .select("profile_id")
      .eq("organization_id", payload.organizationId)
      .eq("username", username)
      .maybeSingle();
    if (existingUErr) {
      return json(500, { error: true, message: `Failed to validate username uniqueness. ${existingUErr.message}` });
    }
    if (existingU) {
      return json(400, { error: true, message: "Username already exists in this organization." });
    }

    // Use the staff member's personal email as their auth login email so:
    // - They can receive password reset emails (when SMTP is configured)
    // - They can sign in with an email they control
    // We still generate a deterministic "staff alias" for display/legacy references.
    const staffAliasEmail = toStaffLoginEmail(username, orgName);
    const loginEmail = personalEmail;
    const tempPassword = generateTempPassword();

    // Create the auth user with the LOGIN email as the primary auth email.
    // Staff sign in directly with their login email.
    // email_confirm: true so the account is immediately active (no email required).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName ?? undefined,
        role: "organization",
        created_by_org: payload.organizationId,
        staff_username: username,
        staff_login_email: loginEmail,
        staff_alias_email: staffAliasEmail,
        personal_email: personalEmail,
      },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Failed to create user.";
      return json(400, { error: true, message: msg });
    }

    const staffId = created.user.id;

    // Upsert profile — store personal email so it's visible in the team table.
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: staffId,
      email: personalEmail,
      full_name: payload.fullName ?? null,
      role: "organization",
    });
    if (profileErr) return json(500, { error: true, message: `Failed to write profile. ${profileErr.message}` });

    // Insert organization membership
    const { error: memberErr } = await admin.from("organization_members").insert({
      organization_id: payload.organizationId,
      profile_id: staffId,
      role: payload.membershipRole,
      username,
    });
    if (memberErr) return json(500, { error: true, message: `Failed to add organization membership. ${memberErr.message}` });

    const emailResult = await sendStaffCredentialsEmail({
      to: personalEmail,
      staffName: payload.fullName ?? null,
      orgName,
      loginEmail,
      tempPassword,
    });

    if (!emailResult.sent) {
      // Best-effort rollback: ensure we do not leave an account behind if delivery fails.
      try {
        await admin.from("organization_members").delete().eq("profile_id", staffId).eq("organization_id", payload.organizationId);
        await admin.from("profiles").delete().eq("id", staffId);
        await admin.auth.admin.deleteUser(staffId);
      } catch {
        // If rollback fails, still fail the request so the UI knows onboarding failed.
      }
      return json(502, {
        error: true,
        message: `Failed to send staff credentials email (${emailResult.provider}): ${emailResult.error}`,
      });
    }

    return json(200, {
      success: true,
      email: loginEmail,
      tempPassword,
      personalEmail,
      delivery: emailResult.sent ? "email" : "manual",
      delivery_attempted: emailResult.attempted,
      delivery_provider: emailResult.provider,
      delivery_error: emailResult.sent ? null : emailResult.error,
      message: emailResult.sent
        ? "Staff account created and credentials email sent to the staff member."
        : emailResult.attempted
          ? `Staff account created, but email delivery failed (${emailResult.provider}): ${emailResult.error}. Share credentials securely with the staff member.`
          : "Staff account created. Share credentials securely with the staff member.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return json(500, { error: true, message: `Unexpected error creating staff account. ${msg}` });
  }
});
