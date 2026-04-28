import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export type ServiceCategory =
  | "housing"
  | "food"
  | "healthcare"
  | "mental_health"
  | "childcare"
  | "job_training"
  | "education"
  | "legal"
  | "other";

export type ServiceRow = {
  id: string;
  organization_id: string;
  name: string;
  category: ServiceCategory;
  description: string | null;
  is_available: boolean;
  hours: string | null;
  eligibility: string | null;
  image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  borough?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CreateServiceInput = {
  organizationId: string;
  name: string;
  category: ServiceCategory;
  description?: string;
  isAvailable?: boolean;
  hours?: string;
  eligibility?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type UpdateServiceAvailabilityInput = {
  serviceId: string;
  isAvailable: boolean;
  hours?: string;
};

export type UpdateServiceInput = {
  serviceId: string;
  name: string;
  description?: string;
  isAvailable: boolean;
  hours?: string;
  eligibility?: string;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type PublicService = {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string | null;
  is_available: boolean;
  hours: string | null;
  eligibility: string | null;
  image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  organization: {
    id: string;
    name: string;
    borough: string;
    phone?: string | null;
    email?: string | null;
    logo_url?: string | null;
  };
};

export type ServiceCategoryOption = {
  slug: string;
  label: string;
  icon?: string | null;
  color?: string | null;
};

export const servicesQueryKeys = {
  all: ["services"] as const,
  categories: () => [...servicesQueryKeys.all, "categories"] as const,
  byOrg: (orgId: string) => [...servicesQueryKeys.all, "org", orgId] as const,
  byId: (serviceId: string) => [...servicesQueryKeys.all, "id", serviceId] as const,
  publicList: (filters: {
    category?: string;
    borough?: string;
    search?: string;
  }) => [...servicesQueryKeys.all, "public", filters] as const,
};

export function useServiceCategories() {
  return useQuery({
    queryKey: servicesQueryKeys.categories(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("slug, label, icon, color")
        .order("label");
      if (error) throw error;
      return (data ?? []) as ServiceCategoryOption[];
    },
    staleTime: 60_000,
  });
}

export function useOrganizationServices(orgId: string | undefined) {
  return useQuery({
    queryKey: servicesQueryKeys.byOrg(orgId ?? ""),
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select(
          "id, organization_id, name, category, description, is_available, hours, eligibility, image_url, latitude, longitude",
        )
        .eq("organization_id", orgId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
    staleTime: 0,
  });
}

export function useServiceById(serviceId: string | undefined) {
  return useQuery({
    queryKey: servicesQueryKeys.byId(serviceId ?? ""),
    enabled: !!serviceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select(
          "id, organization_id, name, category, description, is_available, hours, eligibility, image_url, latitude, longitude",
        )
        .eq("id", serviceId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ServiceRow | null;
    },
    staleTime: 0,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateServiceInput) => {
      const { data, error } = await supabase
        .from("services")
        .insert({
          organization_id: input.organizationId,
          name: input.name,
          category: input.category,
          description: input.description ?? null,
          is_available: input.isAvailable ?? true,
          hours: input.hours ?? null,
          eligibility: input.eligibility ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
        })
        .select(
          "id, organization_id, name, category, description, is_available, hours, eligibility, image_url, latitude, longitude",
        )
        .single();
      if (error) throw error;
      return data as ServiceRow;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: servicesQueryKeys.byOrg(created.organization_id),
      });
      await queryClient.refetchQueries({
        queryKey: servicesQueryKeys.byOrg(created.organization_id),
      });
      // Also refresh any public lists that might include this new service.
      await queryClient.invalidateQueries({ queryKey: servicesQueryKeys.all });
    },
  });
}

export function useUpdateServiceAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateServiceAvailabilityInput) => {
      const { data, error } = await supabase
        .from("services")
        .update({
          is_available: input.isAvailable,
          hours: input.hours?.trim() ? input.hours.trim() : null,
        })
        .eq("id", input.serviceId)
        .select(
          "id, organization_id, name, category, description, is_available, hours, eligibility",
        )
        .single();
      if (error) throw error;
      return data as ServiceRow;
    },
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({
        queryKey: servicesQueryKeys.byOrg(updated.organization_id),
      });
      await queryClient.refetchQueries({
        queryKey: servicesQueryKeys.byOrg(updated.organization_id),
      });
      await queryClient.invalidateQueries({ queryKey: servicesQueryKeys.all });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateServiceInput) => {
      const { data, error } = await supabase
        .from("services")
        .update({
          name: input.name.trim(),
          description: input.description?.trim() ? input.description.trim() : null,
          is_available: input.isAvailable,
          hours: input.hours?.trim() ? input.hours.trim() : null,
          eligibility: input.eligibility?.trim() ? input.eligibility.trim() : null,
          image_url: input.imageUrl ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
        })
        .eq("id", input.serviceId)
        .select(
          "id, organization_id, name, category, description, is_available, hours, eligibility, image_url, latitude, longitude",
        )
        .single();
      if (error) throw error;
      return data as ServiceRow;
    },
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({
        queryKey: servicesQueryKeys.byOrg(updated.organization_id),
      });
      await queryClient.invalidateQueries({
        queryKey: servicesQueryKeys.byId(updated.id),
      });
      await queryClient.invalidateQueries({ queryKey: servicesQueryKeys.all });
    },
  });
}

export function usePublicServices(filters: {
  category?: string;
  borough?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: servicesQueryKeys.publicList(filters),
    queryFn: async () => {
      // NOTE: We join organizations to show org name/borough in the client UI.
      // We also filter to approved orgs only.
      let q = supabase
        .from("services")
        .select(
          "id, name, category, description, is_available, hours, eligibility, image_url, latitude, longitude, organizations:organization_id(id, name, borough, latitude, longitude, phone, email, status, logo_url)",
        )
        .eq("organizations.status", "approved")
        .order("name");

      if (filters.category && filters.category !== "all") {
        q = q.eq("category", filters.category);
      }

      if (filters.borough && filters.borough !== "all") {
        q = q.eq("organizations.borough", filters.borough);
      }

      if (filters.search && filters.search.trim()) {
        const like = `%${filters.search.trim()}%`;
        q = q.ilike("name", like);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Supabase returns nested object as `organizations` alias.
      return (data ?? []).map(
        (r: any) =>
          ({
            id: r.id,
            name: r.name,
            category: r.category,
            description: r.description,
            is_available: r.is_available,
            hours: r.hours,
            eligibility: r.eligibility,
            image_url: r.image_url ?? null,
            latitude: r.latitude,
            longitude: r.longitude,
            organization: {
              id: r.organizations?.id,
              name: r.organizations?.name,
              borough: r.organizations?.borough,
              latitude: r.organizations?.latitude ?? null,
              longitude: r.organizations?.longitude ?? null,
              logo_url: r.organizations?.logo_url ?? null,
              phone: r.organizations?.phone,
              email: r.organizations?.email,
            },
          }) as PublicService,
      );
    },
    staleTime: 10_000,
  });
}
