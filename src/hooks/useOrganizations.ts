/**
 * Organizations Hooks - TanStack Query hooks for organization operations
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  organizationsApi,
  type CreateOrganizationInput,
  type OrganizationRow,
} from "../lib/organzationsApi";

// Query keys for cache management
export const organizationsQueryKeys = {
  all: ["organizations"] as const,
  byOwner: (ownerId: string) =>
    [...organizationsQueryKeys.all, "byOwner", ownerId] as const,
  byUser: (userId: string) =>
    [...organizationsQueryKeys.all, "byUser", userId] as const,
  byId: (id: string) => [...organizationsQueryKeys.all, "byId", id] as const,
  setup: () => [...organizationsQueryKeys.all, "setup"] as const,
};

/**
 * Hook to create an organization
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: organizationsQueryKeys.setup(),
    mutationFn: (input: CreateOrganizationInput) =>
      organizationsApi.setupOrganizationForUser(input),
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.all });
      queryClient.setQueryData(
        organizationsQueryKeys.byOwner(variables.ownerId),
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
    queryKey: organizationsQueryKeys.byUser(userId || ""),
    queryFn: () => organizationsApi.getUserOrganization(userId!),
    enabled: !!userId,
  });
}

/**
 * Hook to get organization by owner
 */
export function useOrganizationByOwner(ownerId: string | undefined) {
  return useQuery({
    queryKey: organizationsQueryKeys.byOwner(ownerId || ""),
    queryFn: () => organizationsApi.getOrganizationByOwner(ownerId!),
    enabled: !!ownerId,
  });
}

/**
 * Hook to get organization by ID
 */
export function useOrganization(id: string | undefined) {
  return useQuery<OrganizationRow | null>({
    queryKey: organizationsQueryKeys.byId(id || ""),
    queryFn: () => organizationsApi.getOrganizationById(id!),
    enabled: !!id,
  });
}
