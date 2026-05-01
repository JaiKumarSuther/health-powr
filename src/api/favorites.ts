import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Get all favorited service IDs for a user.
 * Returns empty array on error — never crashes the page.
 */
export async function getFavorites(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_favorites')
    .select('service_id')
    .eq('user_id', userId);

  if (error) {
    console.error('[getFavorites]', error.message);
    return [];
  }
  return (data ?? []).map((f: any) => f.service_id);
}

/**
 * Toggle a favorite on or off.
 * Returns true if added, false if removed.
 */
export async function toggleFavorite(
  userId: string,
  serviceId: string
): Promise<boolean> {
  // Check if already favorited
  const { data: existing, error: checkError } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('service_id', serviceId)
    .maybeSingle();

  if (checkError) throw new Error(checkError.message);

  if (existing) {
    // Remove favorite
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return false;
  } else {
    // Add favorite
    const { error } = await supabase
      .from('user_favorites')
      .insert({ user_id: userId, service_id: serviceId });
    if (error) throw new Error(error.message);
    return true;
  }
}

export function useFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: () => getFavorites(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceId: string) => toggleFavorite(user!.id, serviceId),
    // Optimistic update — heart fills instantly, reverts on error
    onMutate: async (serviceId: string) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', user?.id] });
      const previous = queryClient.getQueryData<string[]>(['favorites', user?.id]) ?? [];
      const isCurrentlyFavorited = previous.includes(serviceId);
      const updated = isCurrentlyFavorited
        ? previous.filter(id => id !== serviceId)
        : [...previous, serviceId];
      queryClient.setQueryData(['favorites', user?.id], updated);
      return { previous };
    },
    onError: (_err, _serviceId, context) => {
      // Revert on failure
      queryClient.setQueryData(['favorites', user?.id], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });
}
