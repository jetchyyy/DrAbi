import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { useAuth } from '../auth-context';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function PortalLoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const redirectTo = from?.startsWith('/portal') ? from : '/portal';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

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
      {!isSupabaseConfigured ? (
        <div className="border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-widest text-blue-600">Demo Mode</p>
          <p className="text-xs leading-relaxed text-blue-800">
            Use <span className="font-bold">patient@odysseyclinic.test</span> with any password.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500" htmlFor="portal-email">
          Email Address
        </label>
        <Input id="portal-email" placeholder="you@email.com" type="email" {...form.register('email')} />
        {form.formState.errors.email?.message ? (
          <p className="text-xs font-medium text-rose-600">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500" htmlFor="portal-password">
          Password
        </label>
        <div className="relative">
          <Input
            id="portal-password"
            placeholder="********"
            type={showPassword ? 'text' : 'password'}
            className="pr-10"
            {...form.register('password')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {form.formState.errors.password?.message ? (
          <p className="text-xs font-medium text-rose-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <Button
        className="w-full gap-2 rounded-none bg-[#10295e] py-5 text-sm font-extrabold uppercase tracking-widest transition-colors hover:bg-[#08142c]"
        disabled={submitting}
        type="submit"
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogIn className="size-4" />
        )}
        {submitting ? 'Signing in...' : 'Sign In'}
      </Button>

      <div className="flex items-center justify-between pt-1">
        <Link className="text-xs font-bold uppercase tracking-widest text-[#10295e] hover:underline" to="/forgot-password">
          Forgot password?
        </Link>
        <Link className="text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-800" to="/portal/register">
          Create account
        </Link>
      </div>
    </form>
  );
}
