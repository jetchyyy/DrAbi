import { ShieldCheck } from 'lucide-react';

import { PatientRegisterForm } from './components/patient-register-form';

export function PatientRegisterPage() {
  return (
    <div className="grid min-h-screen gap-8 bg-[linear-gradient(145deg,#08142c_0%,#10295e_38%,#f6fbff_38%,#fcfaf4_100%)] px-4 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <section className="flex items-center">
        <div className="max-w-xl text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
            <ShieldCheck className="size-4" />
            Patient account required
          </div>
          <h1 className="mt-6 text-5xl font-semibold leading-tight">
            Create your patient account before booking an appointment.
          </h1>
          <p className="mt-6 max-w-lg text-base text-blue-100">
            Your account keeps your medical history, booking requests, specialist referrals, and future teleconsult visits connected to one patient record.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center">
        <PatientRegisterForm />
      </section>
    </div>
  );
}
