import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useAuth } from '../auth-context';

const resetSchema = z.object({
  email: z.email(),
});

type ResetValues = z.infer<typeof resetSchema>;

export function PasswordResetForm() {
  const { requestPasswordReset } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: 'owner@odysseyclinic.test',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await requestPasswordReset(values.email);
      toast.success('If the account exists, a reset email has been triggered.');
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send reset instructions.');
    } finally {
      setSubmitting(false);
    }
  });

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="bg-emerald-50 border border-emerald-200 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white shrink-0">
              <Mail className="size-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-emerald-800 uppercase tracking-wide">Check your inbox</p>
              <p className="mt-1 text-xs text-emerald-700 leading-relaxed">
                If an account exists for <span className="font-bold">{form.getValues('email')}</span>, a password reset link has been sent. It may take a minute to arrive.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-xs font-extrabold uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Try a different email
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {/* Email field */}
      <div className="space-y-1.5">
        <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500" htmlFor="reset-email">
          Email Address
        </label>
        <Input
          id="reset-email"
          placeholder="you@odysseyclinic.test"
          type="email"
          {...form.register('email')}
        />
        {form.formState.errors.email?.message && (
          <p className="text-xs text-rose-600 font-medium">{form.formState.errors.email.message}</p>
        )}
      </div>

      {/* Submit */}
      <Button
        className="w-full gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 font-extrabold uppercase tracking-widest text-sm py-5 transition-colors"
        disabled={submitting}
        type="submit"
      >
        <Send className="size-4" />
        {submitting ? 'Sending…' : 'Send Reset Link'}
      </Button>

      <p className="text-[11px] text-slate-400 text-center leading-relaxed">
        Uses Supabase Auth when configured. Falls back to demo behavior in local mode.
      </p>
    </form>
  );
}
