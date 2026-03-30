import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { isSupabaseConfigured } from '../../../lib/supabase';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useAuth } from '../auth-context';

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <form className="space-y-5" onSubmit={onSubmit}>
      {/* Demo hint banner */}
      {!isSupabaseConfigured && (
        <div className="bg-orange-50 border border-orange-200 px-4 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-orange-600 mb-1">Demo Mode</p>
          <p className="text-xs text-orange-800 leading-relaxed">
            Use <span className="font-bold">owner@</span>, <span className="font-bold">doctor@</span>, <span className="font-bold">frontdesk@</span>, <span className="font-bold">lab@</span>, or <span className="font-bold">patient@</span> with any password.
          </p>
        </div>
      )}

      {/* Email field */}
      <div className="space-y-1.5">
        <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500" htmlFor="login-email">
          Email Address
        </label>
        <Input
          id="login-email"
          placeholder="you@odysseyclinic.test"
          type="email"
          {...form.register('email')}
        />
        {form.formState.errors.email?.message && (
          <p className="text-xs text-rose-600 font-medium">{form.formState.errors.email.message}</p>
        )}
      </div>

      {/* Password field */}
      <div className="space-y-1.5">
        <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500" htmlFor="login-password">
          Password
        </label>
        <div className="relative">
          <Input
            id="login-password"
            placeholder="••••••••"
            type={showPassword ? 'text' : 'password'}
            className="pr-10"
            {...form.register('password')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {form.formState.errors.password?.message && (
          <p className="text-xs text-rose-600 font-medium">{form.formState.errors.password.message}</p>
        )}
      </div>

      {/* Submit */}
      <Button
        className="w-full gap-2 rounded-none bg-orange-600 hover:bg-orange-700 font-extrabold uppercase tracking-widest text-sm py-5 transition-colors"
        disabled={submitting}
        type="submit"
      >
        <LogIn className="size-4" />
        {submitting ? 'Signing in…' : 'Sign In'}
      </Button>

      {/* Footer links */}
      <div className="flex items-center justify-between pt-1">
        <Link
          className="text-xs font-bold text-orange-600 hover:underline uppercase tracking-widest"
          to="/forgot-password"
        >
          Forgot password?
        </Link>
        <Link
          className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-widest transition-colors"
          to="/portal"
        >
          Patient portal →
        </Link>
      </div>
    </form>
  );
}
