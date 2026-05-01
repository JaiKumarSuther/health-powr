import { supabase } from '../lib/supabase'
import { requireUser } from './requireUser'

export const forumApi = {

  async getThreads(filters?: {
    category?: string
    borough?: string
  }) {
    let query = supabase
      .from('forum_threads')
      .select(`
        *,
        author:profiles!author_id(full_name),
        comment_count
      `)
      .eq('is_moderated', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters?.category) 
      query = query.eq('category', filters.category)
    if (filters?.borough) 
      query = query.eq('borough', filters.borough)

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async createThread(data: {
    title: string
    body: string
    category?: string
    borough?: string
  }) {
    const user = await requireUser()
    const { data: result, error } = await supabase
      .from('forum_threads')
      .insert({ ...data, author_id: user.id })
      .select()
      .single()
    if (error) throw error
    return result
  },

  async getComments(threadId: string) {
    const { data, error } = await supabase
      .from('forum_comments')
      .select(`
        *,
        author:profiles!author_id(full_name, avatar_url)
      `)
      .eq('thread_id', threadId)
      .eq('is_moderated', false)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  async addComment(threadId: string, content: string) {
    const user = await requireUser()
    const { data, error } = await supabase
      .from('forum_comments')
      .insert({ 
        thread_id: threadId,
        author_id: user.id,
        content
      })
      .select()
      .single()
    if (error) throw error
    return data
  }
}
