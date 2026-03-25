import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';

export function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7fbff_0%,#fefbf6_100%)] px-4">
      <Card className="max-w-md p-8">
        <CardTitle className="text-3xl">Password update flow</CardTitle>
        <p className="mt-4 text-sm text-slate-500">
          Supabase redirect handling is already enabled. Final password update UI can be attached here after your project keys are configured.
        </p>
        <Link className="mt-6 inline-flex" to="/login">
          <Button>Back to sign in</Button>
        </Link>
      </Card>
    </div>
  );
}

