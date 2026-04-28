import { supabase } from '../lib/supabase'

export const messagesApi = {

  // Get or create conversation for a request
  async getOrCreateConversation(requestId: string) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id, created_at, updated_at, member_id, organization_id, status, subject')
      .eq('request_id', requestId)
      .maybeSingle()

    if (existing) return existing

    const { data: request } = await supabase
      .from('service_requests')
      .select('member_id, assigned_org_id')
      .eq('id', requestId)
      .single()

    if (!request?.assigned_org_id) {
        throw new Error('Cannot start conversation for unassigned request')
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        request_id: requestId,
        member_id: request.member_id,
        organization_id: request.assigned_org_id
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Get messages in a conversation
  async getMessages(conversationId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(full_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  // Send a message
  async send(conversationId: string, content: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user!.id,
        content
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Get all conversations for current user
  async getMyConversations() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        organization:organizations(id, name, logo_url),
        assigned_staff:profiles!conversations_assigned_staff_id_fkey(id, full_name, avatar_url),
        request:service_requests!request_id(
          id,
          assigned_staff_id,
          borough,
          status,
          created_at,
          services(
            name,
            category
          ),
          assigned_staff:profiles!service_requests_assigned_staff_id_fkey(id, full_name, avatar_url)
        ),
        last_message:messages(content, created_at)
      `)
      .eq('member_id', user!.id)
      // Note: order by last_message_at would require a field in conversations
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Get all conversations for current organization
  async getMyOrgConversations() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role, joined_at')
      .eq('profile_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!membership?.organization_id) return []

    if (membership.role === 'member' || membership.role === 'admin') {
      // Staff member (or org admin staff): only conversations for requests assigned to them.
      const { data: requests, error: reqError } = await supabase
        .from('service_requests')
        .select('id, member_id, assigned_org_id')
        .eq('assigned_staff_id', user.id)
        .eq('assigned_org_id', membership.organization_id)

      if (reqError) throw reqError

      const requestIds = (requests ?? []).map((r: any) => r.id).filter(Boolean)
      if (requestIds.length === 0) return []

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          request_id,
          member_id,
          organization_id,
          last_message_at,
          assigned_staff_id,
          member:profiles!member_id (
            id,
            full_name,
            avatar_url
          ),
          service_request:service_requests!request_id (
            id,
            status,
            borough,
            services (
              name,
              category
            )
          ),
          messages (
            content,
            created_at
          )
        `)
        .eq('organization_id', membership.organization_id)
        .in('request_id', requestIds)
        .order('last_message_at', { ascending: false })

      if (error) throw error
      return data ?? []
    }

    // Owner: no client chat (owner only chats with staff via /cbo/team).
    if (membership.role === 'owner') return []

    // Admin staff (role=admin) can still chat if assigned, but must be assigned_staff_id.
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        request_id,
        member_id,
        organization_id,
        last_message_at,
        assigned_staff_id,
        member:profiles!member_id (
          id,
          full_name,
          avatar_url
        ),
        service_request:service_requests!request_id (
          id,
          status,
          borough,
          services (
            name,
            category
          )
        ),
        messages (
          content,
          created_at
        )
      `)
      .eq('organization_id', membership.organization_id)
      .eq('assigned_staff_id', user.id)
      .order('last_message_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Subscribe to new messages (realtime)
  subscribeToMessages(
    conversationId: string,
    onMessage: (msg: Record<string, unknown>) => void
  ) {
    return supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, payload => onMessage(payload.new))
      .subscribe()
  }
}

// ─── Internal Messaging API ───────────────────────────────

export async function getInternalConversations() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // Get user's org ID
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership?.organization_id) return []

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      conversation_type,
      title,
      organization_id,
      last_message_at,
      conversation_participants (
        profile_id,
        last_read_at,
        profiles!conversation_participants_profile_id_fkey (
          id,
          full_name,
          avatar_url
        )
      ),
      messages (
        id,
        content,
        created_at,
        sender_id
      )
    `)
    .eq('organization_id', membership.organization_id)
    .in('conversation_type', ['direct', 'group'])
    .order('last_message_at', { ascending: false })

  if (error) {
    console.error('[getInternalConversations] error:', error)
    throw error
  }

  console.log('[getInternalConversations] raw data:', data)
  return (data ?? []).map((conv: any) => ({
    ...conv,
    messages: [...(conv.messages ?? [])].sort(
      (a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
  }))
}

// Create a new direct conversation between two org members
export async function createDirectConversation(
  organizationId: string,
  otherProfileId: string
) {
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({
      organization_id: organizationId,
      conversation_type: 'direct',
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (convError) throw convError

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error: participantsError } = await supabase.from('conversation_participants').insert([
    { conversation_id: conv.id, profile_id: user.id },
    { conversation_id: conv.id, profile_id: otherProfileId },
  ])
  if (participantsError) throw participantsError

  return conv.id as string
}

// Get or create a direct conversation (prevents duplicates)
export async function getOrCreateDirectConversation(
  organizationId: string,
  otherProfileId: string
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if a direct conv already exists between these two
  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select(`
      id,
      conversation_participants!inner(profile_id)
    `)
    .eq('organization_id', organizationId)
    .eq('conversation_type', 'direct')
    .eq('conversation_participants.profile_id', otherProfileId)

  if (existingError) throw existingError

  if (existing && existing.length > 0) {
    return existing[0].id as string
  }

  return createDirectConversation(organizationId, otherProfileId)
}

// Subscribe to internal conversations list (new messages bubble up)
export function subscribeToInternalConversations(
  organizationId: string,
  onUpdate: () => void
) {
  return supabase
    .channel(`internal:${organizationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
    }, () => onUpdate())
    .subscribe()
}
