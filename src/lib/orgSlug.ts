export function toOrgSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function toStaffLoginEmail(params: { username: string; orgName: string }) {
  const username = params.username.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "");
  const orgSlug = toOrgSlug(params.orgName) || "org";
  // Domain must be a valid email domain. We use a subdomain per org.
  // Example: john@abc-organization.healthpowr.app
  return `${username}@${orgSlug}.healthpowr.app`;
}

