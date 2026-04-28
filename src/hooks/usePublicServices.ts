import { useQuery } from "@tanstack/react-query";
import { getPublicServices } from "../api/services";

export function usePublicServices(filters?: {
  category?: string;
  borough?: string;
}) {
  return useQuery({
    queryKey: ["public-services", filters],
    queryFn: () => getPublicServices(filters),
    staleTime: 1000 * 60 * 5, // 5 min cache — fine for public landing page
  });
}
