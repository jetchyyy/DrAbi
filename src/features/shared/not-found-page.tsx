import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7fbff_0%,#fefbf6_100%)] px-4">
      <Card className="max-w-md p-8 text-center">
        <CardTitle className="text-3xl">Page not found</CardTitle>
        <p className="mt-3 text-sm text-slate-500">The route does not exist in this clinic workspace.</p>
        <Link className="mt-6 inline-flex" to="/app/dashboard">
          <Button>Go to dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}

