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

type ProofPayloadV1 = {
  v: 1;
  iat: number; // epoch seconds
  exp: number; // epoch seconds
  nonce: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeJson(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return base64UrlEncode(bytes);
}

function base64UrlDecodeToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signProof(secret: string, payload: ProofPayloadV1): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncodeJson(header);
  const payloadB64 = base64UrlEncodeJson(payload);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), data);
  return `${headerB64}.${payloadB64}.${base64UrlEncode(new Uint8Array(sig))}`;
}

async function verifyProof(secret: string, token: string): Promise<ProofPayloadV1 | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  // Verify signature first
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = base64UrlDecodeToBytes(sigB64);
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, data);
  if (!ok) return null;
  // Parse payload
  try {
    const payloadBytes = base64UrlDecodeToBytes(payloadB64);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as ProofPayloadV1;
    if (payload?.v !== 1) return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    if (typeof payload.nonce !== "string") return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  } as const;
}

function json(status: number, body: unknown, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";

  // 1. Handle OPTIONS immediately for CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  try {
    // Use the ALLOWED_ORIGIN secret if set, otherwise fallback to common dev origins.
    const allowedRaw = (Deno.env.get("ALLOWED_ORIGIN") ?? "http://localhost:5000,http://localhost:3000,https://health-powr-eta.vercel.app").trim();
    
    const allowed = parseAllowedOrigins(allowedRaw);
    const isAllowed = allowed.includes("*") || (origin && allowed.includes(origin));

    if (!isAllowed) {
      console.error(`[verify-admin-passkey] Forbidden origin: ${origin}`);
      return new Response(JSON.stringify({ 
        error: "Forbidden origin", 
        details: `Origin ${origin} is not in the allowed list.` 
      }), {
        status: 403,
        headers: { "content-type": "application/json", ...corsHeaders(origin || "*") },
      });
    }

    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" }, origin);
    }

    const expectedPasskey = (Deno.env.get("ADMIN_PASSKEY") ?? "").trim();
    if (!expectedPasskey) {
      console.error("[verify-admin-passkey] Missing ADMIN_PASSKEY secret.");
      return json(500, { error: "Server misconfigured (Missing ADMIN_PASSKEY)." }, origin);
    }

    const payload = (await req.json().catch(() => null)) as
      | { passkey?: string; proof?: string }
      | null;

    const submittedProof = payload?.proof?.trim() ?? "";
    if (submittedProof) {
      const verified = await verifyProof(expectedPasskey, submittedProof);
      if (!verified) {
        console.log("[verify-admin-passkey] Proof verification failed.");
        return json(403, { valid: false, error: "Invalid proof." }, origin);
      }
      return json(200, { valid: true, proof: submittedProof, expiresAt: verified.exp }, origin);
    }

    const submittedPasskey = payload?.passkey?.trim() ?? "";
    if (!submittedPasskey) {
      return json(400, { error: "Passkey is required." }, origin);
    }

    if (!timingSafeEqual(submittedPasskey, expectedPasskey)) {
      console.log("[verify-admin-passkey] Passkey mismatch.");
      return json(403, { valid: false, error: "Invalid passkey." }, origin);
    }

    // Issue a short-lived proof (10 minutes).
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 10 * 60;
    const nonce = crypto.randomUUID();
    const proof = await signProof(expectedPasskey, { v: 1, iat: now, exp, nonce });
    
    console.log("[verify-admin-passkey] Passkey verified, issuing proof.");
    return json(200, { valid: true, proof, expiresAt: exp }, origin);

  } catch (err: unknown) {
    console.error("[verify-admin-passkey] Runtime error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "Internal server error", details: message }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders(origin || "*") },
    });
  }
});
