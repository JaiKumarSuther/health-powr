export type UserRole = 'community_member' | 'organization' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  organization?: string;
  organization_id?: string;
}
