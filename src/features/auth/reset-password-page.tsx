import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle, Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type NewPasswordValues = z.infer<typeof newPasswordSchema>;

type PageState = 'waiting' | 'ready' | 'submitting' | 'done' | 'error';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>(
    isSupabaseConfigured ? 'waiting' : 'ready',
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // Two-pronged approach to detect the recovery session:
  // 1. getSession() — catches cases where Supabase already processed the URL
  //    hash token before our listener was registered (common in SPAs).
  // 2. onAuthStateChange — catches cases where the event fires after mount.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let active = true;

    // Check if there is already an active session (Supabase may have already
    // exchanged the URL hash token before this component mounted).
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) {
        setPageState('ready');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('ready');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      setPageState('submitting');
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
      setPageState('done');
      // Sign the user out after password update so they log in fresh
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setPageState('error');
    }
  });

  return (
    <div className="min-h-screen flex">

      {/* ── Left branding panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col bg-[#172937] relative overflow-hidden">
        {/* Animated aurora background */}
        <div
          className="absolute inset-0 animate-aurora opacity-70"
          style={{
            background:
              'linear-gradient(135deg, #172937 0%, #1f3a52 25%, #2d5a7b 45%, #172937 60%, #1a2f45 80%, #172937 100%)',
            backgroundSize: '400% 400%',
          }}
        />

        {/* Floating orbs */}
        <div
          className="pointer-events-none absolute animate-orb-1"
          style={{
            top: '-80px', right: '-60px', width: '380px', height: '380px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.25) 0%, rgba(234,88,12,0.08) 60%, transparent 80%)',
          }}
        />
        <div
          className="pointer-events-none absolute animate-orb-2"
          style={{
            bottom: '-50px', left: '10%', width: '280px', height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,146,60,0.18) 0%, rgba(249,115,22,0.06) 65%, transparent 85%)',
          }}
        />

        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 39px, #fff 39px, #fff 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #fff 39px, #fff 40px)',
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--color-primary)]" />

        <div className="relative z-10 flex flex-col h-full px-12 py-12">
          <div className="animate-slide-left">
            <img src="/odc.jpg" alt="Odyssey Clinic Logo" className="h-16 w-16 object-contain" />
            <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.3em] text-slate-400">Clinic OS Access</p>
            <h1 className="mt-1.5 text-2xl font-extrabold text-white leading-tight">
              Odyssey Clinic<br />Operations System
            </h1>
          </div>
          <div className="mt-auto animate-fade-up delay-200">
            <div className="p-5 bg-white/5 border border-white/10 inline-block mb-6">
              <KeyRound className="size-10" style={{color:'var(--color-primary)'}} />
            </div>
            <p className="text-base font-semibold text-white max-w-xs leading-relaxed">
              Set a strong new password to secure your clinic account.
            </p>
            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                © {new Date().getFullYear()} Odyssey Diagnostic Clinic
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right content panel ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 relative">
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1 bg-[var(--color-primary)]" />
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3">
          <img src="/odc.jpg" alt="ODC Logo" className="h-9 w-9 object-contain" />
          <p className="text-sm font-extrabold text-slate-950 uppercase tracking-widest">Odyssey Clinic</p>
        </div>

        <div className="w-full max-w-sm animate-fade-up">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-500 hover:text-slate-800 mb-8 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to Sign In
          </Link>

          <div className="mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Password Update</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-950 tracking-tight">Create new password</h2>
          </div>

          {/* ── Not configured (local / missing env) ── */}
          {!isSupabaseConfigured && (
            <div className="border border-slate-200 bg-slate-50 px-5 py-4 mb-6">
              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                Configure your <span className="font-extrabold">VITE_SUPABASE_URL</span> and{' '}
                <span className="font-extrabold">VITE_SUPABASE_ANON_KEY</span> environment variables to activate
                live password reset.
              </p>
            </div>
          )}

          {/* ── Waiting for the PASSWORD_RECOVERY event ── */}
          {pageState === 'waiting' && (
            <div className="flex flex-col items-center gap-4 py-10 text-slate-500">
              <Loader2 className="size-8 animate-spin" style={{color:'var(--color-primary)'}} />
              <p className="text-sm font-semibold text-center">
                Verifying your reset link…
              </p>
            </div>
          )}

          {/* ── Ready: show the form ── */}
          {pageState === 'ready' && (
            <form className="space-y-5" onSubmit={onSubmit}>
              {/* New password */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500" htmlFor="new-password">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    {...form.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {form.formState.errors.password?.message && (
                  <p className="text-xs text-rose-600 font-medium">{form.formState.errors.password.message}</p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat your new password"
                    {...form.register('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {form.formState.errors.confirmPassword?.message && (
                  <p className="text-xs text-rose-600 font-medium">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                className="w-full gap-2 rounded-xl bg-[var(--color-primary)] hover:brightness-95 font-extrabold uppercase tracking-widest text-sm py-5 transition-colors"
                type="submit"
              >
                <KeyRound className="size-4" />
                Update Password
              </Button>
            </form>
          )}

          {/* ── Submitting ── */}
          {pageState === 'submitting' && (
            <div className="flex flex-col items-center gap-4 py-10 text-slate-500">
              <Loader2 className="size-8 animate-spin" style={{color:'var(--color-primary)'}} />
              <p className="text-sm font-semibold">Updating your password…</p>
            </div>
          )}

          {/* ── Done ── */}
          {pageState === 'done' && (
            <div className="bg-emerald-50 border border-emerald-200 px-5 py-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-600 text-white shrink-0">
                  <CheckCircle className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-emerald-800 uppercase tracking-wide">Password updated!</p>
                  <p className="mt-1 text-xs text-emerald-700 leading-relaxed">
                    Your password has been changed successfully. Redirecting you to the sign-in page…
                  </p>
                </div>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-emerald-700 hover:text-emerald-900 transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Go to Sign In
              </Link>
            </div>
          )}

          {/* ── Error ── */}
          {pageState === 'error' && (
            <div className="space-y-5">
              <div className="bg-rose-50 border border-rose-200 px-5 py-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-600 text-white shrink-0">
                    <ShieldAlert className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-rose-800 uppercase tracking-wide">Update failed</p>
                    <p className="mt-1 text-xs text-rose-700 leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setPageState('ready'); setErrorMessage(''); form.reset(); }}
                className="text-xs font-extrabold uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
              >
                ← Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
