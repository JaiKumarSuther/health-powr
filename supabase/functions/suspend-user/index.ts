// Supabase Edge Function: suspend-user
// Suspends or reactivates a community member account.
// Requires the calling user to be an admin (verified via profiles table).
// Uses SERVICE ROLE key to call auth.admin API and update profiles.is_active.

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
    console.error("[suspend-user] Missing ALLOWED_ORIGIN secret.");
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
      return json(500, { error: "Server misconfigured." }, origin);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json(401, { error: "Missing Authorization header." }, origin);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify caller and confirm they are an admin.
    const { data: callerData, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !callerData?.user) {
      return json(401, { error: "Not authenticated." }, origin);
    }
    const callerId = callerData.user.id;

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();

    if (callerProfile?.role !== "admin") {
      return json(403, { error: "Forbidden: admin role required." }, origin);
    }

    const body = (await req.json().catch(() => null)) as null | {
      userId?: string;
      suspend?: boolean;
    };

    const userId = body?.userId?.trim();
    // Default to suspending; pass suspend:false to reactivate.
    const suspend = body?.suspend !== false;

    if (!userId) {
      return json(400, { error: "userId is required." }, origin);
    }

    // Cannot suspend another admin.
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfile?.role === "admin") {
      return json(403, { error: "Cannot suspend an admin account." }, origin);
    }

    // Update auth user metadata.
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { suspended: suspend },
    });
    if (authErr) {
      return json(500, { error: `Failed to update auth user: ${authErr.message}` }, origin);
    }

    // Update profiles.is_active.
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ is_active: !suspend })
      .eq("id", userId);
    if (profileErr) {
      // Non-fatal if column doesn't exist yet — auth metadata update is the source of truth.
      console.error("Failed to update profiles.is_active:", profileErr.message);
    }

    return json(200, { success: true, suspended: suspend }, origin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return json(500, { error: `Unexpected error: ${msg}` }, origin);
  }
});
