import type { PatientWithReferral } from "../hooks/use-referral-frontdesk";

interface PatientsWithReferralsPageProps {
  patients: PatientWithReferral[];
  selectedPatient: PatientWithReferral | null;
  loading: boolean;
  error: string | null;
  onSelectPatient: (patient: PatientWithReferral) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PatientsWithReferralsPage({
  patients,
  selectedPatient,
  loading,
  error,
  onSelectPatient,
}: PatientsWithReferralsPageProps) {
  if (loading) {
    return (
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-6 py-4">
            <div className="h-9 w-9 shrink-0 animate-pulse bg-slate-100" />
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="h-3.5 w-2/3 animate-pulse bg-slate-100" />
              <div className="h-3 w-1/2 animate-pulse bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-5">
        <p className="text-sm font-bold text-rose-700">
          Failed to load patients
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{error}</p>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
          No referrals found
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Patients with active referrals will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {patients.map((patient) => {
        const isSelected = selectedPatient?.referralId === patient.referralId;
        return (
          <button
            key={patient.referralId}
            onClick={() => onSelectPatient(patient)}
            className={`w-full px-6 py-4 text-left transition-colors hover:bg-slate-50 ${isSelected ? "bg-orange-50" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {/* Avatar — matches appointments initials block */}
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border text-xs font-extrabold ${
                    isSelected
                      ? "border-orange-200 bg-orange-100 text-orange-700"
                      : "border-orange-100 bg-orange-50 text-orange-700"
                  }`}
                >
                  {getInitials(patient.patient.fullName)}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-950">
                    {patient.patient.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Dr. {patient.doctor.fullName}
                  </p>
                  {patient.doctor.specialtyName && (
                    <p className="mt-1 text-xs italic text-slate-400">
                      {patient.doctor.specialtyName}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {isSelected ? (
                  <span className="bg-orange-600 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white">
                    Selected
                  </span>
                ) : (
                  <span className="bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
                    Pending
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
