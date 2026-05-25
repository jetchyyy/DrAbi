import { CalendarCheck2, Clock, UserCheck } from "lucide-react";

import { PatientsWithReferralsPage } from "./components/patients-with-referral-page";
import { SpecialistScheduleListPage } from "./components/specialist-schedule-page";
import { useReferralFrontdesk } from "./hooks/use-referral-frontdesk";

export function ReferralFrontdeskPage() {
  const {
    patients,
    paginatedPatients,
    selectedPatient,
    schedules,
    selectedSchedule,
    selectedDate,
    selectedTime,
    bookedSlots, // ← now wired through
    loading,
    schedulesLoading,
    bookingLoading,
    error,
    bookingError,
    bookingSuccess,
    searchQuery,
    currentPage,
    totalPages,
    filteredCount,
    setSearchQuery,
    setCurrentPage,
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
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] p-2 text-[var(--color-primary)] ring-1 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]">
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
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 ring-1 ring-slate-200/80">
              {patients.length} referral{patients.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <PatientsWithReferralsPage
          patients={paginatedPatients}
          selectedPatient={selectedPatient}
          loading={loading}
          error={error}
          onSelectPatient={selectPatient}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentPage={currentPage}
          totalPages={totalPages}
          filteredCount={filteredCount}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ── Right Panel: Schedule & Booking ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-6 py-4">
          <div className="flex shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] p-2 text-[var(--color-primary)] ring-1 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]">
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
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-600 ring-1 ring-slate-200/80">
              <Clock className="size-3" />
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
          bookedSlots={bookedSlots}
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

export { ReferralFrontdeskPage as ReferralPage };
