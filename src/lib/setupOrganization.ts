/**
 * Shared utility for invoking the setup-organization edge function.
 * Used by AuthContext (on signup) and CBODashboard (on first load).
 * Centralised here so any change to headers/URL is applied once.
 */
import { supabase } from "./supabase";

/**
 * Calls the `setup-organization` Supabase edge function.
 * Obtains the access token from the current session automatically.
 * Throws if the session is missing or the function returns a non-OK response.
 */
export async function invokeSetupOrganization(
  orgName: string,
  borough: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke("setup-organization", {
    body: { orgName, borough },
  });
  if (error) throw error;
}
