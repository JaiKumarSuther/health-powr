export type UserRole = 
  'community_member' | 'organization' | 'admin'

export type RequestStatus = 
  'new' | 'in_review' | 'in_progress' | 'closed'

export type RequestPriority = 
  'low' | 'medium' | 'high'

export type ServiceCategory = 
  'housing' | 'food' | 'healthcare' | 
  'job_training' | 'education' | 'legal' |
  'mental_health' | 'childcare' | 'other'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  borough: string | null
  created_at: string
  avatar_url?: string | null
}

export interface Organization {
  id: string
  name: string
  description: string | null
  category: ServiceCategory[]
  borough: string
  status: 'pending' | 'approved' | 'rejected'
  address: string | null
  phone: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  hours_of_operation: Record<string, string> | null
}

export interface ServiceRequest {
  id: string
  member_id: string
  category: ServiceCategory
  borough: string
  description: string
  service_id?: string | null
  status: RequestStatus
  priority: RequestPriority
  assigned_org_id: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  // joined
  member?: Profile
  organization?: Organization
  status_history?: StatusHistory[]
}

export interface StatusHistory {
  id: string
  request_id: string
  changed_by: string
  old_status: RequestStatus | null
  new_status: RequestStatus
  note: string | null
  created_at: string
  profiles?: Profile
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  sender?: Profile
}

export interface OrganizationSummary {
  id: string;
  name: string;
  logo_url?: string | null;
}

export interface ServiceSummary {
  name: string;
  category: string;
}

export interface ServiceRequestSummary {
  id: string;
  assigned_staff_id: string | null;
  borough: string | null;
  status: string;
  created_at: string;
  services?: ServiceSummary | null;
  assigned_staff?: Pick<Profile, "id" | "full_name"> & { avatar_url?: string | null } | null;
}

export interface ConversationListItem {
  id: string;
  request_id: string | null;
  member_id: string;
  organization_id: string;
  status?: string | null;
  subject?: string | null;
  created_at: string;
  updated_at?: string | null;
  last_message_at?: string | null;
  organization?: OrganizationSummary | null;
  assigned_staff?: (Pick<Profile, "id" | "full_name"> & { avatar_url?: string | null }) | null;
  request?: ServiceRequestSummary | null;
  last_message?: { content: string; created_at: string }[] | null;
  // some queries return these alternate shapes
  service_request?: ServiceRequestSummary | null;
  member?: (Pick<Profile, "id" | "full_name"> & { avatar_url?: string | null }) | null;
  messages?: { content: string; created_at: string }[] | null;
}

export interface ForumThread {
  id: string
  author_id: string
  title: string
  body: string
  category: ServiceCategory | null
  borough: string | null
  is_pinned: boolean
  created_at: string
  author?: Profile
  comment_count?: { count: number }[]
}

export interface ForumComment {
  id: string
  thread_id: string
  author_id: string
  content: string
  created_at: string
  author?: Profile
}
