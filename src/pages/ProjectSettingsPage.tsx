import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { AlertCircle, Trash2, UserMinus, UserPlus, Settings, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { Button, Input, Textarea, Card, Badge, Avatar, Modal, Select } from '@/components/ui';
import type { Project, ProjectMember, MemberRole } from '@/types/project';
import { cn } from '@/lib/cn';

interface EditProjectFormData {
  name: string;
  description: string;
  color: string;
}

interface InviteMemberFormData {
  email: string;
  role: MemberRole;
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#f43f5e',
];

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { register: registerEdit, handleSubmit: handleEditSubmit, watch: watchEdit, setValue: setEditValue, reset: resetEdit } = useForm<EditProjectFormData>();
  const selectedColor = watchEdit('color');

  const { register: registerInvite, handleSubmit: handleInviteSubmit, formState: { errors: inviteErrors }, reset: resetInvite } = useForm<InviteMemberFormData>({
    defaultValues: { role: 'member' as MemberRole },
  });

  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId!)
        .single();

      if (error) throw error;
      resetEdit({
        name: data.name,
        description: data.description || '',
        color: data.color,
      });
      return data as Project;
    },
    enabled: !!projectId,
  });

  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: ['project_members', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select('*, profiles(*)')
        .eq('project_id', projectId!);

      if (error) throw error;
      return data as ProjectMember[];
    },
    enabled: !!projectId,
  });

  const currentUserMember = members?.find((m) => m.user_id === user?.id);
  const isOwner = currentUserMember?.role === 'owner';
  const isAdmin = isOwner || currentUserMember?.role === 'admin';

  const updateProjectMutation = useMutation({
    mutationFn: async (data: EditProjectFormData) => {
      const { data: updated, error } = await supabase
        .from('projects')
        .update({
          name: data.name,
          description: data.description,
          color: data.color,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId!)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      pushToast({ title: 'Project updated', description: 'Changes saved successfully.' });
    },
    onError: (err: Error) => pushToast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async (data: InviteMemberFormData) => {
      // 1. Check if the user already has an account on the platform
      const { data: existingProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', data.email);

      if (profileError) throw profileError;

      // 2. If they already exist, add them directly to the project!
      if (existingProfiles && existingProfiles.length > 0) {
        const { error: memberError } = await supabase
          .from('project_members')
          .insert({
            project_id: projectId!,
            user_id: existingProfiles[0].id,
            role: data.role,
          });

        if (memberError) throw memberError;
        return { type: 'member', email: data.email };
      }

      // 3. If they don't exist yet, create a pending invitation
      const { data: invitation, error } = await supabase
        .from('project_invitations')
        .insert({
          project_id: projectId!,
          invited_email: data.email,
          role: data.role,
          invited_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return { type: 'invitation', ...invitation };
    },
    onSuccess: (data) => {
      setIsInviteModalOpen(false);
      resetInvite();
      if (data.type === 'member') {
        queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
        pushToast({ title: 'User added', description: 'User was already registered and has been added to the project!' });
      } else {
        pushToast({ title: 'Invitation sent', description: 'User has been invited and will be added upon registration.' });
      }
    },
    onError: (err: Error) => pushToast({ title: 'Error inviting user', description: err.message, variant: 'destructive' }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_members', projectId] });
      pushToast({ title: 'Member removed', description: 'The user has been removed from the project.' });
    },
  });

  const leaveProjectMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserMember) throw new Error('Not a member');
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', currentUserMember.id);
      if (error) throw error;
    },
    onSuccess: () => {
      pushToast({ title: 'Left project', description: 'You have left the project.' });
      navigate('/projects');
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId!);
      if (error) throw error;
    },
    onSuccess: () => {
      pushToast({ title: 'Project deleted', description: 'The project has been permanently deleted.' });
      navigate('/projects');
    },
  });

  if (isProjectLoading || isMembersLoading) {
    return <div className="p-8 text-muted-foreground">Loading settings…</div>;
  }

  if (!project) {
    return <div className="p-8 text-muted-foreground">Project not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-muted-foreground mt-2">Manage project details, team members, and preferences.</p>
      </div>

      {/* General settings (admin/owner only) */}
      {isAdmin && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Settings className="text-muted-foreground" size={20} />
            <h2 className="text-xl font-semibold">General</h2>
          </div>

          <form onSubmit={handleEditSubmit((d) => updateProjectMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project Name</label>
              <Input {...registerEdit('name', { required: true })} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea {...registerEdit('description')} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Project Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full transition-all focus:outline-none',
                      selectedColor === color ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110' : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditValue('color', color)}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateProjectMutation.isPending}>
                {updateProjectMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Team members */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground" size={20} />
            <h2 className="text-xl font-semibold">Team Members</h2>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setIsInviteModalOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invite Member
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {members?.map((member) => {
            const displayName = member.profiles?.display_name || member.profiles?.email || 'Unknown';
            const initials = displayName.slice(0, 2).toUpperCase();
            return (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/50">
                <div className="flex items-center gap-3">
                  <Avatar name={initials} color="#3b82f6" />
                  <div>
                    <p className="font-medium">{displayName}</p>
                    <p className="text-sm text-muted-foreground">{member.profiles?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge>{member.role}</Badge>
                  {isAdmin && member.user_id !== user?.id && member.role !== 'owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      disabled={removeMemberMutation.isPending}
                    >
                      <UserMinus className="h-4 w-4 text-rose-500" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="p-6 space-y-6 border-rose-200 dark:border-rose-900">
        <div className="flex items-center gap-2 border-b border-rose-200 dark:border-rose-900 pb-4 text-rose-600">
          <AlertCircle size={20} />
          <h2 className="text-xl font-semibold">Danger Zone</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h3 className="font-medium text-foreground">Leave Project</h3>
            <p className="text-sm text-muted-foreground">Revoke your access to this project.</p>
          </div>
          <Button
            variant="secondary"
            disabled={isOwner}
            onClick={() => {
              if (window.confirm('Are you sure you want to leave this project?')) {
                leaveProjectMutation.mutate();
              }
            }}
          >
            Leave Project
          </Button>
        </div>

        {isOwner && (
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center pt-4 border-t border-rose-200 dark:border-rose-900">
            <div>
              <h3 className="font-medium text-foreground">Delete Project</h3>
              <p className="text-sm text-muted-foreground">Permanently delete this project and all its data.</p>
            </div>
            <Button variant="destructive" onClick={() => setIsDeleteModalOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete Project
            </Button>
          </div>
        )}
      </Card>

      {/* Invite Modal */}
      <Modal open={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Member">
        <form onSubmit={handleInviteSubmit((d) => inviteMemberMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <Input
              type="email"
              {...registerInvite('email', { required: 'Email is required' })}
            />
            {inviteErrors.email && <p className="mt-1 text-xs text-rose-600">{inviteErrors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <Select {...registerInvite('role')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsInviteModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={inviteMemberMutation.isPending}>
              {inviteMemberMutation.isPending ? 'Sending…' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Project">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be undone and will permanently delete all associated tasks, files, and member access.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteProjectMutation.mutate()}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? 'Deleting…' : 'Delete Project'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
