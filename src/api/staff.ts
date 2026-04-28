import { supabase } from "../lib/supabase";

export const staffApi = {
  async createStaffAccount(input: {
    organizationId: string;
    organizationName: string;
    username: string;
    personalEmail: string;
    fullName?: string;
    membershipRole: "admin" | "member";
  }): Promise<{ success: true; email: string; tempPassword: string; personalEmail?: string; message?: string; delivery?: "email" | "manual" }> {
    // Force a fresh token — getSession() can return a stale cached token.
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session) {
      throw new Error(refreshErr?.message || "Session expired — please sign in again.");
    }
    const accessToken = refreshed.session.access_token;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!supabaseUrl || !anonKey) {
      throw new Error("Missing Supabase configuration.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(`${supabaseUrl}/functions/v1/create-staff-account`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new Error("Request timed out while creating staff (20s). Please try again.");
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    let body: Record<string, unknown> | null = null;
    try {
      body = await res.json();
    } catch {
      // non-JSON response
    }

    // Not deployed / wrong project URL, etc.
    if (res.status === 404) {
      throw new Error(
        "Staff account creation unavailable — server function not deployed. Contact your system administrator.",
      );
    }

    const msgFromBody =
      (body?.message as string | undefined) ||
      (typeof body?.error === "string" ? (body.error as string) : undefined);

    // Hard fail on non-2xx
    if (!res.ok) {
      console.error("[create-staff-account] error", { status: res.status, body });
      throw new Error(msgFromBody || `Request failed (${res.status}).`);
    }

    // Also fail if body explicitly indicates an error
    if (body && body.error === true) {
      throw new Error(msgFromBody || "Request failed.");
    }

    const data = body as
      | { success: true; email: string; tempPassword: string; personalEmail?: string; message?: string; delivery?: "email" | "manual" }
      | null;
    if (!data?.success || !data.email || !data.tempPassword) {
      throw new Error("Unexpected response from server. Please try again.");
    }
    return data;
  },
};
