import { supabase } from "../lib/supabase";

export interface PublicService {
  id: string;
  name: string;
  description: string;
  category: string;
  eligibility: string;
  hours: string;
  is_available: boolean;
  image_url?: string | null;
  organizations: {
    id: string;
    name: string;
    borough: string;
    latitude: number | null;
    longitude: number | null;
    avatar_url?: string;
  };
}

// Fetches services without requiring an auth session
export async function getPublicServices(filters?: {
  category?: string;
  borough?: string;
}) {
  let query = supabase
    .from("services")
    .select(`
      id,
      name,
      description,
      category,
      eligibility,
      hours,
      is_available,
      image_url,
      organization_id,
      organizations!organization_id (
        id,
        name,
        borough,
        latitude,
        longitude,
        avatar_url:logo_url
      )
    `)
    .eq("is_available", true);

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  if (filters?.borough) {
    // Note: This relies on the join with organizations table
    query = query.eq("organizations.borough", filters.borough);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as PublicService[];
}
