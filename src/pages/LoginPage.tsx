import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button, Input, Card } from '@/components/ui';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <img src="/sys-ges-logo.png" alt="Sys-Ges Logo" className="h-16 w-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in to your account</h1>
          <p className="text-sm text-muted-foreground">Welcome back to Sys-Ges</p>
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
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  {...register('email')}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-1">
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  {...register('password')}
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                <div className="flex justify-end pt-1">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Don't have an account? </span>
              <Link to="/register" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
