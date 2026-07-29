export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MemberRole = 'owner' | 'admin' | 'member';

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profiles?: Profile;
  projects?: Project;
}

export interface ProjectInvitation {
  id: string;
  project_id: string;
  invited_email: string;
  invited_by: string;
  role: MemberRole;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
  created_at: string;
  expires_at: string;
}
