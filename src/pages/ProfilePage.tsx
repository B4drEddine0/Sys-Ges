import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { Button, Input, Card } from '@/components/ui';

interface ProfileFormData {
  display_name: string;
  avatar_url: string;
}

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { pushToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
    defaultValues: {
      display_name: profile?.display_name || '',
      avatar_url: profile?.avatar_url || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: data.display_name,
          avatar_url: data.avatar_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: data.display_name },
      });

      if (authError) throw authError;

      await refreshProfile();

      pushToast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      pushToast({
        title: 'Error updating profile',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (profile?.display_name ?? user?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your account settings and personal information.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex items-center space-x-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-accent-foreground">
              {initials}
            </div>
            <div>
              <h3 className="text-lg font-medium">{profile?.display_name || 'Anonymous User'}</h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="display_name" className="block text-sm font-medium mb-1">
                Display Name
              </label>
              <Input
                id="display_name"
                {...register('display_name', { required: 'Display name is required' })}
                placeholder="John Doe"
              />
              {errors.display_name && <p className="mt-1 text-xs text-rose-600">{errors.display_name.message}</p>}
            </div>

            <div>
              <label htmlFor="avatar_url" className="block text-sm font-medium mb-1">
                Avatar URL
              </label>
              <Input
                id="avatar_url"
                {...register('avatar_url')}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
