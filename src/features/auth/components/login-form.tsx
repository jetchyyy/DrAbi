import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { isSupabaseConfigured } from '../../../lib/supabase';
import { Button } from '../../../components/ui/button';
import { Card, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { useAuth } from '../auth-context';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'owner@odysseyclinic.test',
      password: 'demo1234',
    },
  });

  const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/app/dashboard';

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await signIn(values.email, values.password);
      toast.success('Welcome back.');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Card className="w-full max-w-md p-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Clinic OS Access</p>
        <CardTitle className="text-3xl">Sign in</CardTitle>
        <p className="text-sm text-slate-500">
          {isSupabaseConfigured
            ? 'Sign in with your live Supabase account.'
            : 'Demo roles: owner@, doctor@, frontdesk@, lab@, inventory@, or patient@.'}
        </p>
      </div>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div>
          <Input placeholder="Email address" {...form.register('email')} />
          <p className="mt-2 text-xs text-rose-600">{form.formState.errors.email?.message}</p>
        </div>
        <div>
          <Input placeholder="Password" type="password" {...form.register('password')} />
          <p className="mt-2 text-xs text-rose-600">{form.formState.errors.password?.message}</p>
        </div>
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link className="text-[var(--color-primary)]" to="/forgot-password">
          Forgot password?
        </Link>
        <Link className="text-slate-500" to="/portal/register">
          Create account
        </Link>
      </div>
    </Card>
  );
}
