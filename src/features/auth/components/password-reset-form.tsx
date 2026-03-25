import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '../../../components/ui/button';
import { Card, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { useAuth } from '../auth-context';

const resetSchema = z.object({
  email: z.email(),
});

type ResetValues = z.infer<typeof resetSchema>;

export function PasswordResetForm() {
  const { requestPasswordReset } = useAuth();
  const [submitting, setSubmitting] = useState(false);
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send reset instructions.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Card className="w-full max-w-md p-8">
      <CardTitle className="text-3xl">Reset password</CardTitle>
      <p className="mt-2 text-sm text-slate-500">
        Uses Supabase Auth when configured and falls back to demo behavior in local mode.
      </p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div>
          <Input placeholder="Email address" {...form.register('email')} />
          <p className="mt-2 text-xs text-rose-600">{form.formState.errors.email?.message}</p>
        </div>
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? 'Sending...' : 'Send reset instructions'}
        </Button>
      </form>
    </Card>
  );
}

