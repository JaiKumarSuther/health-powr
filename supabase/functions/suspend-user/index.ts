// Supabase Edge Function: suspend-user
// Suspends or reactivates a community member account.
// Requires the calling user to be an admin (verified via profiles table).
// Uses SERVICE ROLE key to call auth.admin API and update profiles.is_active.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": ALLOWED_ORIGIN,
        "access-control-allow-headers":
          "authorization, x-client-info, apikey, content-type",
        "access-control-allow-methods": "POST, OPTIONS",
      },
    });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Server misconfigured." });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json(401, { error: "Missing Authorization header." });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify caller and confirm they are an admin.
    const { data: callerData, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !callerData?.user) {
      return json(401, { error: "Not authenticated." });
    }
    const callerId = callerData.user.id;

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();

    if (callerProfile?.role !== "admin") {
      return json(403, { error: "Forbidden: admin role required." });
    }

    const body = (await req.json().catch(() => null)) as null | {
      userId?: string;
      suspend?: boolean;
    };

    const userId = body?.userId?.trim();
    // Default to suspending; pass suspend:false to reactivate.
    const suspend = body?.suspend !== false;

    if (!userId) {
      return json(400, { error: "userId is required." });
    }

    // Cannot suspend another admin.
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfile?.role === "admin") {
      return json(403, { error: "Cannot suspend an admin account." });
    }

    // Update auth user metadata.
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { suspended: suspend },
    });
    if (authErr) {
      return json(500, { error: `Failed to update auth user: ${authErr.message}` });
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

    return json(200, { success: true, suspended: suspend });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return json(500, { error: `Unexpected error: ${msg}` });
  }
});
