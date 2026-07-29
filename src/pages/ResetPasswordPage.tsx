import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button, Input, Card } from '@/components/ui';

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your password');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <img src="/sys-ges-logo.png" alt="Sys-Ges Logo" className="h-16 w-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Set new password</h1>
          <p className="text-sm text-muted-foreground">Please enter your new password below</p>
        </div>

        <Card className="p-8 shadow-2xl rounded-3xl border-border bg-card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-100/10 border border-red-500/20 rounded-xl">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1">
                <Input
                  id="password"
                  type="password"
                  placeholder="New Password"
                  {...register('password')}
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>

              <div className="space-y-1">
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm New Password"
                  {...register('confirmPassword')}
                  className={errors.confirmPassword ? 'border-red-500' : ''}
                />
                {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Updating password...' : 'Update password'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
