export const queryKeys = {
  profile: (id: string) => ["profiles", id] as const,
  orgMembers: (orgId: string) => ["organization_members", orgId] as const,
  serviceRequests: (orgId: string) => ["service_requests", orgId] as const,
  user: () => ["user"] as const,
  cboReports: (orgId: string, period: string, customFrom?: string, customTo?: string) =>
    ["cbo_reports", orgId, period, customFrom ?? "", customTo ?? ""] as const,
};

