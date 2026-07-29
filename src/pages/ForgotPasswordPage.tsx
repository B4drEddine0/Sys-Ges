import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button, Input, Card } from '@/components/ui';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <img src="/sys-ges-logo.png" alt="Sys-Ges Logo" className="h-16 w-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground">Enter your email to receive a password reset link</p>
        </div>

        <Card className="p-8 shadow-2xl rounded-3xl border-border bg-card">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="p-4 text-sm text-green-600 bg-green-100/10 border border-green-500/20 rounded-xl">
                Password reset link sent! Check your email.
              </div>
              <div className="pt-4">
                <Link to="/login" className="text-sm font-medium text-primary hover:underline">
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-100/10 border border-red-500/20 rounded-xl">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    {...register('email')}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Sending link...' : 'Send reset link'}
              </Button>

              <div className="text-center text-sm pt-2">
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
