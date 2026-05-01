import { supabase } from '../lib/supabase';
import { requireUser } from './requireUser';

export const announcementsApi = {
  async getComments(announcementId: string) {
    const { data, error } = await supabase
      .from('announcement_comments')
      .select(`
        *,
        author:profiles!user_id(full_name, avatar_url)
      `)
      .eq('announcement_id', announcementId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async addComment(announcementId: string, content: string) {
    const user = await requireUser();
    const { data, error } = await supabase
      .from('announcement_comments')
      .insert({
        announcement_id: announcementId,
        user_id: user.id,
        content
      })
      .select(`
        *,
        author:profiles!user_id(full_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data;
  }
};
