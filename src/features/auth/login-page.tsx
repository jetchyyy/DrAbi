import { ShieldCheck } from 'lucide-react';

import { LoginForm } from './components/login-form';

export function LoginPage() {
  return (
    <div className="grid min-h-screen gap-8 bg-[linear-gradient(145deg,#08142c_0%,#10295e_38%,#f6fbff_38%,#fcfaf4_100%)] px-4 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
      <section className="flex items-center">
        <div className="max-w-xl text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
            <ShieldCheck className="size-4" />
            Clinic management platform
          </div>
          <h1 className="mt-6 text-5xl font-semibold leading-tight">
            Staff workflows, patient booking, and Supabase-ready operations in one stack.
          </h1>
          <p className="mt-6 max-w-lg text-base text-blue-100">
            Built for a single clinic today with branding, services, booking rules, and role controls already structured for future white-label rollout.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center">
        <LoginForm />
      </section>
    </div>
  );
}

