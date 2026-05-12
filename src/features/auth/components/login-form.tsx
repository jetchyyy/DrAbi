import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { getHomePathForRole } from '../../../lib/role-routing';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { useAuth } from '../auth-context';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  defaultRedirectTo?: string;
}

export function LoginForm({ defaultRedirectTo }: LoginFormProps) {
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      const role = await signIn(values.email, values.password, captchaToken);
      toast.success('Welcome back.');
      navigate((location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? defaultRedirectTo ?? getHomePathForRole(role ?? profile?.role), { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {!isSupabaseConfigured ? (
        <div className="rounded-2xl border border-emerald-200/75 bg-emerald-50/80 px-4 py-3.5 shadow-sm shadow-emerald-900/[0.04]">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800">Local mode</p>
          <p className="text-xs leading-relaxed text-emerald-900/90">
            The local database starts empty. Sign in with any email and password to begin adding records manually.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="login-email">
          Email address
        </label>
        <Input id="login-email" placeholder="you@yourclinic.com" type="email" className="border-slate-200/90 py-3" {...form.register('email')} />
        {form.formState.errors.email?.message ? <p className="text-xs font-medium text-rose-600">{form.formState.errors.email.message}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="login-password">
          Password
        </label>
        <div className="relative">
          <Input
            id="login-password"
            placeholder="••••••••"
            type={showPassword ? 'text' : 'password'}
            className="border-slate-200/90 py-3 pr-10"
            {...form.register('password')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {form.formState.errors.password?.message ? <p className="text-xs font-medium text-rose-600">{form.formState.errors.password.message}</p> : null}
      </div>

      <div className="flex justify-end">
        <Link
          className="text-[13px] font-medium text-slate-500 underline-offset-[3px] transition-colors hover:text-slate-700 hover:underline"
          to="/forgot-password"
        >
          Forgot password?
        </Link>
      </div>

      {isSupabaseConfigured && (
        <div className="flex justify-center py-2">
          <Turnstile
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
            onSuccess={(token) => setCaptchaToken(token)}
          />
        </div>
      )}

      <Button
        variant="primary"
        className="w-full gap-2 rounded-full py-3.5 text-sm font-semibold tracking-tight shadow-lg shadow-green-900/12 ring-1 ring-black/[0.04] transition-[filter] hover:brightness-[0.98] disabled:brightness-100"
        disabled={submitting}
        type="submit"
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogIn className="size-4" strokeWidth={2.25} />
        )}
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-center text-[11px] leading-relaxed text-slate-400 pt-0.5">
        Need portal access?{' '}
        <Link
          className="font-medium text-slate-500 underline-offset-[3px] transition-colors hover:text-slate-800 hover:underline"
          to="/portal/register"
        >
          Patient registration
        </Link>
      </p>
    </form>
  );
}
