import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgsApi } from "../api/organizations";

export type AdminOrgStatus = "pending" | "approved" | "rejected" | "suspended";

export type AdminOrg = {
  id: string;
  name: string;
  description: string | null;
  borough: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  category: string[] | null;
  languages_supported: string[] | null;
  status: AdminOrgStatus;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  is_active: boolean;
  owner: {
    full_name: string | null;
    email: string | null;
  } | null;
};

export const adminOrganizationsQueryKeys = {
  all: ["admin", "organizations"] as const,
  list: () => [...adminOrganizationsQueryKeys.all, "list"] as const,
};

export function useAdminOrganizations(enabled: boolean) {
  return useQuery({
    queryKey: adminOrganizationsQueryKeys.list(),
    queryFn: async () => {
      const data = (await orgsApi.getAll()) as unknown as AdminOrg[];
      const seen = new Set<string>();
      return (data ?? []).filter((org) => {
        if (!org?.id) return false;
        if (seen.has(org.id)) return false;
        seen.add(org.id);
        return true;
      });
    },
    enabled,
    staleTime: 10_000,
  });
}

export function useUpdateOrganizationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      orgId: string;
      status: "approved" | "rejected" | "suspended";
      reason?: string;
    }) => orgsApi.updateStatus(input.orgId, input.status, input.reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: adminOrganizationsQueryKeys.all,
      });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orgId: string) => orgsApi.delete(orgId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: adminOrganizationsQueryKeys.all,
      });
    },
  });
}
