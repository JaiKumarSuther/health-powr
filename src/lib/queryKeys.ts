export const queryKeys = {
  user: () => ["user"] as const,
  profile: (id: string) => ["profiles", id] as const,

  orgByUser: (userId: string) => ["organization", "by_user", userId] as const,
  orgByOwner: (ownerId: string) => ["organization", "by_owner", ownerId] as const,
  orgById: (id: string) => ["organization", "by_id", id] as const,
  orgMembers: (orgId: string) => ["org_members", orgId] as const,

  serviceRequests: (orgId: string, filters?: object) =>
    ["service_requests", orgId, filters ?? {}] as const,

  services: (orgId: string) => ["services", "by_org", orgId] as const,
  serviceById: (id: string) => ["services", "by_id", id] as const,
  serviceCategories: () => ["services", "categories"] as const,
  servicesPublic: (filters?: object) => ["services", "public", filters ?? {}] as const,

  conversations: (orgId: string) => ["conversations", orgId] as const,
  conversationDetail: (id: string) => ["conversations", "detail", id] as const,
  messages: (conversationId: string) => ["messages", conversationId] as const,

  cboReports: (orgId: string, range = "week") => ["cbo_reports", orgId, range] as const,
  cboReportsCustom: (orgId: string, period: string, customFrom?: string, customTo?: string) =>
    ["cbo_reports", orgId, period, customFrom ?? "", customTo ?? ""] as const,

  favorites: (userId: string) => ["favorites", userId] as const,

  adminOrgs: (filters?: object) => ["admin", "organizations", filters ?? {}] as const,
  adminUsers: (filters?: object) => ["admin", "users", filters ?? {}] as const,
  adminUsersCommunityMembers: () => ["admin", "users", "community_members"] as const,
  adminUserRequests: (userId?: string) => ["admin", "users", "requests", userId ?? ""] as const,
  adminOverview: () => ["admin", "overview"] as const,
  adminRequestsList: (page: number) => ["admin", "requests", "list", page] as const,
  adminReportsSummary: () => ["admin", "reports", "summary"] as const,
};

