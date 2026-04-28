/**
 * Public site origin for auth email links (signup confirmation, etc.).
 * In production, set VITE_SITE_URL (e.g. https://your-app.vercel.app) in the
 * host’s environment so confirmation emails use the deployed URL. Locally,
 * when unset, the current browser origin is used.
 */
export function getSiteUrlForAuth(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}
