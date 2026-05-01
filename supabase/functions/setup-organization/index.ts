// Supabase Edge Function: setup-organization
// Atomically creates an organization record and adds the calling user as owner.
// Runs with SERVICE ROLE key so it bypasses RLS — safe because we verify the
// caller's JWT and enforce owner_id = auth.uid() in the insert.
//
// Required secrets (set in Supabase function env):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  } as const;
}

function json(status: number, body: unknown, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

Deno.serve(async (req) => {
  const allowedRaw = (Deno.env.get("ALLOWED_ORIGIN") ?? "").trim();
  if (!allowedRaw) {
    console.error("[setup-organization] Missing ALLOWED_ORIGIN secret.");
    return new Response(JSON.stringify({ error: "Server misconfigured." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const origin = (req.headers.get("origin") ?? "").trim();
  const allowed = parseAllowedOrigins(allowedRaw);
  if (!origin || !allowed.includes(origin)) {
    return new Response(JSON.stringify({ error: "Forbidden origin." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, origin);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." }, origin);
    }

    // Verify the caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json(401, { error: "Missing Authorization header." }, origin);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: callerData, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !callerData?.user) {
      return json(401, { error: "Not authenticated." }, origin);
    }
    const callerId = callerData.user.id;
    const callerEmail = callerData.user.email ?? "";
    const callerName =
      (callerData.user.user_metadata?.full_name as string | undefined) ||
      (callerData.user.user_metadata?.name as string | undefined) ||
      null;

    const body = (await req.json().catch(() => null)) as null | {
      orgName?: string;
      borough?: string;
    };

    const orgName = body?.orgName?.trim();
    const borough = body?.borough?.trim() || "Manhattan";

    if (!orgName) {
      return json(400, { error: "orgName is required." }, origin);
    }

    // Ensure caller exists in public.profiles before writing FKs.
    // In some flows (fresh verify / missing trigger), the profile row can lag behind auth.users.
    const { error: profileErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: callerId,
          email: callerEmail || null,
          full_name: callerName,
          role: "organization",
          borough,
        },
        { onConflict: "id" },
      );
    if (profileErr) {
      return json(500, { error: `Failed to ensure profile: ${profileErr.message}` }, origin);
    }

    // Idempotency check: if user is already an owner of an org with this name,
    // return success so duplicate calls are safe.
    const { data: existing } = await admin
      .from("organization_members")
      .select("organization_id, organizations:organization_id(id, name)")
      .eq("profile_id", callerId)
      .eq("role", "owner")
      .maybeSingle();

    if (existing?.organization_id) {
      return json(200, { success: true, organizationId: existing.organization_id, alreadyExisted: true }, origin);
    }

    // Upsert the organization on owner_id — safe against race-condition duplicate calls.
    // ignoreDuplicates:true means a second call with the same owner_id is a no-op.
    const { data: upsertedOrg, error: orgErr } = await admin
      .from("organizations")
      .upsert(
        {
          owner_id: callerId,
          name: orgName,
          email: callerEmail,
          borough,
          status: "pending",
        },
        { onConflict: "owner_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();

    if (orgErr) {
      return json(500, { error: `Failed to create organization: ${orgErr.message}` }, origin);
    }

    // If ignoreDuplicates suppressed the upsert, fetch the existing row.
    let orgId: string;
    if (upsertedOrg?.id) {
      orgId = upsertedOrg.id;
    } else {
      const { data: existingOrg, error: fetchErr } = await admin
        .from("organizations")
        .select("id")
        .eq("owner_id", callerId)
        .maybeSingle();
      if (fetchErr || !existingOrg?.id) {
        return json(500, { error: "Failed to retrieve organization after upsert." }, origin);
      }
      orgId = existingOrg.id;
    }

    // Add the caller as owner
    const { error: memberErr } = await admin.from("organization_members").insert({
      organization_id: orgId,
      profile_id: callerId,
      role: "owner",
    });

    if (memberErr) {
      // Duplicate membership is acceptable (idempotent)
      if (!memberErr.code?.startsWith("23505") && !memberErr.message?.toLowerCase().includes("unique")) {
        return json(500, { error: `Failed to add organization membership: ${memberErr.message}` }, origin);
      }
    }

    return json(200, { success: true, organizationId: orgId }, origin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return json(500, { error: `Unexpected error: ${msg}` }, origin);
  }
});
