// Supabase Edge Function: verify-admin-passkey
// Validates admin passkey server-side so it never appears in the client bundle.
//
// Required secrets (set via `supabase secrets set`):
// - ADMIN_PASSKEY: The admin passkey string

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const CORS_HEADERS = {
  "access-control-allow-origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const expectedPasskey = Deno.env.get("ADMIN_PASSKEY");
  if (!expectedPasskey) {
    return json(500, { error: "Admin passkey not configured on server." });
  }

  const payload = (await req.json().catch(() => null)) as {
    passkey?: string;
  } | null;

  const submittedPasskey = payload?.passkey?.trim() ?? "";
  if (!submittedPasskey) {
    return json(400, { error: "Passkey is required." });
  }

  if (!timingSafeEqual(submittedPasskey, expectedPasskey)) {
    return json(403, { valid: false, error: "Invalid passkey." });
  }

  return json(200, { valid: true });
});
