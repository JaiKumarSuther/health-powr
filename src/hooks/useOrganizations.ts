/**
 * Organizations Hooks - TanStack Query hooks for organization operations
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  organizationsApi,
  type CreateOrganizationInput,
  type OrganizationRow,
} from "../lib/organzationsApi";
import { queryKeys } from "../lib/queryKeys";

/**
 * Hook to create an organization
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["organization", "setup"],
    mutationFn: (input: CreateOrganizationInput) =>
      organizationsApi.setupOrganizationForUser(input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.orgByOwner(variables.ownerId),
        exact: true,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.orgByUser(variables.ownerId),
        exact: true,
      });
      queryClient.setQueryData(
        queryKeys.orgByOwner(variables.ownerId),
        data.organization,
      );
    },
  });
}

/**
 * Hook to get user's organization
 */
export function useUserOrganization(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orgByUser(userId || ""),
    queryFn: () => organizationsApi.getUserOrganization(userId!),
    enabled: !!userId,
  });
}

/**
 * Hook to get organization by owner
 */
export function useOrganizationByOwner(ownerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orgByOwner(ownerId || ""),
    queryFn: () => organizationsApi.getOrganizationByOwner(ownerId!),
    enabled: !!ownerId,
  });
}

/**
 * Hook to get organization by ID
 */
export function useOrganization(id: string | undefined) {
  return useQuery<OrganizationRow | null>({
    queryKey: queryKeys.orgById(id || ""),
    queryFn: () => organizationsApi.getOrganizationById(id!),
    enabled: !!id,
  });
}
