import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Users, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { Button, Card, Modal, Input, Textarea, Badge, Skeleton } from '@/components/ui';
import type { ProjectMember } from '@/types/project';
import { cn } from '@/lib/cn';

interface CreateProjectFormData {
  name: string;
  description: string;
  color: string;
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#f43f5e',
];

export function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<CreateProjectFormData>({
    defaultValues: { color: COLORS[7], name: '', description: '' },
  });

  const selectedColor = watch('color');

  const { data: members, isLoading } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('project_members')
        .select('*, projects (*)')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as ProjectMember[];
    },
    enabled: !!user,
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: CreateProjectFormData) => {
      if (!user) throw new Error('Not authenticated');

      
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: data.name,
          description: data.description,
          color: data.color,
          created_by: user.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: project.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateModalOpen(false);
      reset();
      pushToast({
        title: 'Project created',
        description: 'Your new project has been created successfully.',
      });
    },
    onError: (error: Error) => {
      pushToast({
        title: 'Failed to create project',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CreateProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <img src="/sys-ges-logo.png" alt="Sys-Ges" className="h-10 w-10 rounded-2xl object-contain" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
              <p className="text-muted-foreground mt-1">Manage and access your projects.</p>
            </div>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4" /> Create Project
          </Button>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="pt-4 flex justify-between">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : members?.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20 border-2 border-dashed rounded-3xl border-border bg-card/50">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/15 text-accent mb-4">
              <Plus className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              You are not a member of any projects. Create a new project to get started.
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>Create your first project</Button>
          </div>
        ) : (
          /* Project grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members?.map((member) => {
              const project = member.projects;
              if (!project) return null;
              return (
                <Card
                  key={member.id}
                  className="group relative overflow-hidden transition-all hover:shadow-md cursor-pointer border border-border"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: project.color }} />
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-accent transition-colors">
                        {project.name}
                      </h3>
                      <Badge>{member.role}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-6 min-h-[2.5rem]">
                      {project.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span>Team</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/project/${project.id}/settings`);
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Project Modal */}
        <Modal
          open={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            reset();
          }}
          title="Create New Project"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Project Name *
              </label>
              <Input
                id="name"
                {...register('name', { required: 'Project name is required' })}
                placeholder="e.g. Website Redesign"
                autoFocus
              />
              {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description
              </label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="What is this project about?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Project Color
              </label>
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
                    onClick={() => setValue('color', color)}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createProjectMutation.isPending}>
                {createProjectMutation.isPending ? 'Creating…' : 'Create Project'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
