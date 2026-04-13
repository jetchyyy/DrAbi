import { CalendarCheck2, Clock, UserCheck } from "lucide-react";

import { PatientsWithReferralsPage } from "./components/patients-with-referral-page";
import { SpecialistScheduleListPage } from "./components/specialist-schedule-page";
import { useReferralFrontdesk } from "./hooks/use-referral-frontdesk";

export function ReferralFrontdeskPage() {
  const {
    patients,
    selectedPatient,
    schedules,
    selectedSchedule,
    selectedDate,
    selectedTime,
    loading,
    schedulesLoading,
    bookingLoading,
    error,
    bookingError,
    bookingSuccess,
    selectPatient,
    selectSchedule,
    setSelectedDate,
    setSelectedTime,
    bookAppointment,
    resetBooking,
  } = useReferralFrontdesk();

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      {/* ── Left Panel: Patients with Referrals ── */}
      <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 bg-orange-600 p-2 text-white">
              <UserCheck className="size-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">
                Referrals
              </p>
              <p className="text-[11px] font-medium text-slate-400">
                Patients pending specialist booking
              </p>
            </div>
          </div>
          {!loading && (
            <span className="bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-700">
              {patients.length} referral{patients.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <PatientsWithReferralsPage
          patients={patients}
          selectedPatient={selectedPatient}
          loading={loading}
          error={error}
          onSelectPatient={selectPatient}
        />
      </div>

      {/* ── Right Panel: Schedule & Booking ── */}
      <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-6 py-4">
          <div className="shrink-0 bg-orange-600 p-2 text-white">
            <CalendarCheck2 className="size-4" />
          </div>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">
              Schedule &amp; Booking
            </p>
            <p className="text-[11px] font-medium text-slate-400">
              {selectedPatient
                ? `Booking for ${selectedPatient.patient.fullName}`
                : "Select a patient to begin"}
            </p>
          </div>
          {selectedPatient && (
            <span className="ml-auto bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-sky-700">
              <Clock className="mr-1 inline size-3" />
              {selectedPatient.doctor.specialtyName ?? "Specialist"}
            </span>
          )}
        </div>

        <SpecialistScheduleListPage
          selectedPatient={selectedPatient}
          schedules={schedules}
          selectedSchedule={selectedSchedule}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          schedulesLoading={schedulesLoading}
          bookingLoading={bookingLoading}
          bookingError={bookingError}
          bookingSuccess={bookingSuccess}
          onSelectSchedule={selectSchedule}
          onSetDate={setSelectedDate}
          onSetTime={setSelectedTime}
          onBook={() => void bookAppointment()}
          onReset={resetBooking}
        />
      </div>
    </div>
  );
}

/** Alias so existing imports of `ReferralPage` keep working */
export { ReferralFrontdeskPage as ReferralPage };
