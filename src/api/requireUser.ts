import { supabase } from "../lib/supabase";

export class AuthError extends Error {
  name = "AuthError" as const;
}

export async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new AuthError(error.message);
  if (!data?.user) throw new AuthError("User not authenticated");
  return data.user;
}

