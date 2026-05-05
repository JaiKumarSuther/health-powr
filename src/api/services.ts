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

const VALID_CATEGORIES = [
  'housing',
  'food',
  'healthcare',
  'job_training',
  'education',
  'legal',
  'mental_health',
  'childcare',
  'other'
];

// Fetches services without requiring an auth session
export async function getPublicServices(filters?: {
  category?: string;
  borough?: string;
  searchText?: string;
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

  if (filters?.category && filters.category !== 'all' && VALID_CATEGORIES.includes(filters.category)) {
    query = query.eq("category", filters.category);
  }

  if (filters?.searchText) {
    // Use individual .ilike() calls instead of a raw .or() string to avoid
    // special characters in the search term corrupting the PostgREST filter.
    const term = `%${filters.searchText}%`;
    query = query.or(`name.ilike.${term},description.ilike.${term}`);
  }

  if (filters?.borough) {
    // Note: This relies on the join with organizations table
    query = query.eq("organizations.borough", filters.borough);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as PublicService[];
}
