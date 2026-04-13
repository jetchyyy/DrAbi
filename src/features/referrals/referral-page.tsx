import { useState } from "react";
import { CalendarClock, GitMerge, Stethoscope, User } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  useSpecialists,
  usePatientBookings,
  useLinkReferralMutation,
} from "./hooks/use-referral";
import { useQuery } from "@tanstack/react-query";
import { getDoctorAvailabilityByDoctorIdLiveOrDemo } from "../../lib/supabase-clinic";
import { SpecialistList } from "./components/specialist-list";
import { PatientList } from "./components/patient-list";
import { ScheduleList } from "./components/schedule-list";
import type { SpecialistItem, PatientBookingItem } from "./hooks/use-referral";
import type { ScheduleSlot } from "./components/schedule-list";

type Tab = "specialist" | "patient" | "schedule";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "specialist", label: "Specialist", icon: Stethoscope },
  { key: "patient", label: "Patient", icon: User },
  { key: "schedule", label: "Schedule", icon: CalendarClock },
];

export function ReferralPage() {
  const [activeTab, setActiveTab] = useState<Tab>("specialist");
  const [selectedSpecialist, setSelectedSpecialist] =
    useState<SpecialistItem | null>(null);
  const [selectedPatient, setSelectedPatient] =
    useState<PatientBookingItem | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const specialistsQuery = useSpecialists();
  const patientBookingsQuery = usePatientBookings();

  const availabilityQuery = useQuery({
    queryKey: ["doctor-availability", selectedSpecialist?.id ?? null],
    queryFn: () =>
      getDoctorAvailabilityByDoctorIdLiveOrDemo(selectedSpecialist?.id ?? null),
    enabled: Boolean(selectedSpecialist?.id),
  });

  const linkReferralMutation = useLinkReferralMutation();

  const canProceedToPatient = Boolean(selectedSpecialist);
  const canProceedToSchedule = Boolean(selectedPatient?.referralId);
  const canSubmit =
    Boolean(selectedSpecialist) &&
    Boolean(selectedPatient) &&
    Boolean(selectedSlot) &&
    Boolean(selectedPatient?.referralId);

  function handleSelectSpecialist(specialist: SpecialistItem) {
    setSelectedSpecialist(specialist);
    setSelectedSlot(null);
  }

  function handleSelectPatient(patient: PatientBookingItem) {
    setSelectedPatient(patient);
    setSelectedSlot(null);
  }

  function handleTabChange(tab: Tab) {
    if (tab === "patient" && !canProceedToPatient) return;
    if (tab === "schedule" && !canProceedToSchedule) return;
    setActiveTab(tab);
  }

  function handleSubmit() {
    if (
      !selectedPatient?.referralId ||
      !selectedPatient.bookingId ||
      !selectedSlot?.scheduledAt
    ) {
      return;
    }

    linkReferralMutation.mutate(
      {
        bookingId: selectedPatient.bookingId,
        referralId: selectedPatient.referralId,
        scheduledAt: selectedSlot.scheduledAt,
      },
      {
        onSuccess: () => {
          setSuccessMessage(
            `Referral linked for ${selectedPatient.patientFullName} on ${selectedSlot.scheduledAt.replace("T", " ").slice(0, 16)}.`,
          );
          setSelectedSpecialist(null);
          setSelectedPatient(null);
          setSelectedSlot(null);
          setActiveTab("specialist");
        },
      },
    );
  }

  return (
    <div className="grid gap-6">
      {successMessage && (
        <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {successMessage}
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="ml-4 text-xs font-extrabold uppercase tracking-widest underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {linkReferralMutation.isError && (
        <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {linkReferralMutation.error instanceof Error
            ? linkReferralMutation.error.message
            : "An error occurred. Please try again."}
        </div>
      )}

      <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 bg-orange-600 p-2 text-white">
              <GitMerge className="size-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">
                Referral Scheduling
              </p>
              <p className="text-[11px] font-medium text-slate-400">
                Link bookings to referrals and assign specialist slots
              </p>
            </div>
          </div>

          {selectedSpecialist && (
            <span className="bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
              {selectedSpecialist.fullName}
            </span>
          )}
        </div>

        <div className="flex border-b border-slate-100">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isDisabled =
              (key === "patient" && !canProceedToPatient) ||
              (key === "schedule" && !canProceedToSchedule);
            const isActive = activeTab === key;

            return (
              <button
                key={key}
                type="button"
                disabled={isDisabled}
                onClick={() => handleTabChange(key)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest transition-colors",
                  isActive
                    ? "border-orange-600 text-orange-600"
                    : "border-transparent text-slate-400 hover:text-slate-700",
                  isDisabled && "cursor-not-allowed opacity-30",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {activeTab === "specialist" && (
          <>
            <div className="px-6 py-5">
              <p className="mb-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Select a Specialist
              </p>
              <SpecialistList
                specialists={specialistsQuery.data ?? []}
                selectedId={selectedSpecialist?.id ?? null}
                onSelect={handleSelectSpecialist}
                isLoading={specialistsQuery.isLoading}
              />
            </div>

            {selectedSpecialist && (
              <div className="bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("patient")}
                  className="w-full bg-orange-600 py-3 text-sm font-extrabold uppercase tracking-widest text-white hover:bg-orange-700"
                >
                  Continue to Patient
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "patient" && (
          <>
            <div className="px-6 py-5">
              <p className="mb-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Select a Patient Booking
              </p>
              <PatientList
                patients={patientBookingsQuery.data ?? []}
                selectedBookingId={selectedPatient?.bookingId ?? null}
                onSelect={handleSelectPatient}
                isLoading={patientBookingsQuery.isLoading}
              />
            </div>

            {selectedPatient && !selectedPatient.referralId && (
              <div className="border-t border-slate-100 bg-orange-50 px-6 py-3">
                <p className="text-[11px] font-medium text-orange-700">
                  This patient does not have an existing referral ID. A referral
                  must exist before it can be linked.
                </p>
              </div>
            )}

            {selectedPatient?.referralId && (
              <div className="bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("schedule")}
                  className="w-full bg-orange-600 py-3 text-sm font-extrabold uppercase tracking-widest text-white hover:bg-orange-700"
                >
                  Continue to Schedule
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "schedule" && (
          <>
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Scheduling For
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-950">
                {selectedPatient?.patientFullName}
              </p>
              <p className="text-xs text-slate-500">
                {selectedSpecialist?.fullName}
                {selectedSpecialist?.specialtyName
                  ? ` · ${selectedSpecialist.specialtyName}`
                  : ""}
              </p>
            </div>

            <div className="px-6 py-5">
              <p className="mb-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Available Slots
              </p>
              <ScheduleList
                availability={availabilityQuery.data ?? []}
                selectedSlot={selectedSlot}
                onSelect={setSelectedSlot}
                isLoading={availabilityQuery.isLoading}
              />
            </div>

            <div className="bg-slate-50 px-6 py-4">
              <button
                type="button"
                disabled={!canSubmit || linkReferralMutation.isPending}
                onClick={handleSubmit}
                className={cn(
                  "w-full py-3 text-sm font-extrabold uppercase tracking-widest text-white transition-colors",
                  canSubmit && !linkReferralMutation.isPending
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "cursor-not-allowed bg-slate-300",
                )}
              >
                {linkReferralMutation.isPending
                  ? "Saving..."
                  : "Confirm & Link Referral"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
