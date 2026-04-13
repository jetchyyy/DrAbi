import { useMemo } from "react";
import { CalendarCheck2, Clock, MapPin } from "lucide-react";

import type {
  PatientWithReferral,
  SpecialistSchedule,
} from "../hooks/use-referral-frontdesk";
import { getDayNamesFromRecurrence } from "../hooks/use-referral-frontdesk";

interface SpecialistScheduleListPageProps {
  selectedPatient: PatientWithReferral | null;
  schedules: SpecialistSchedule[];
  selectedSchedule: SpecialistSchedule | null;
  selectedDate: string;
  selectedTime: string;
  schedulesLoading: boolean;
  bookingLoading: boolean;
  bookingError: string | null;
  bookingSuccess: boolean;
  onSelectSchedule: (schedule: SpecialistSchedule) => void;
  onSetDate: (date: string) => void;
  onSetTime: (time: string) => void;
  onBook: () => void;
  onReset: () => void;
}

const DAY_INDEX: Record<number, number> = {
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 0,
};

function getAvailableDatesForSchedule(
  schedule: SpecialistSchedule,
  daysAhead = 60,
): string[] {
  const results: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validFrom = schedule.validFrom ? new Date(schedule.validFrom) : today;
  const startDate = validFrom > today ? validFrom : today;
  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const jsDay = date.getDay();
    if (schedule.recurrence.some((r) => DAY_INDEX[r] === jsDay)) {
      results.push(date.toISOString().slice(0, 10));
    }
  }
  return results;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function SpecialistScheduleListPage({
  selectedPatient,
  schedules,
  selectedSchedule,
  selectedDate,
  selectedTime,
  schedulesLoading,
  bookingLoading,
  bookingError,
  bookingSuccess,
  onSelectSchedule,
  onSetDate,
  onSetTime,
  onBook,
  onReset,
}: SpecialistScheduleListPageProps) {
  const availableDates = useMemo(() => {
    if (!selectedSchedule) return [];
    return getAvailableDatesForSchedule(selectedSchedule);
  }, [selectedSchedule]);

  const availableSlots = useMemo(() => {
    if (!selectedSchedule) return [];
    return selectedSchedule.slotTemplate.map((s) => s.start);
  }, [selectedSchedule]);

  // ── No patient selected ────────────────────────────────────────────────────
  if (!selectedPatient) {
    return (
      <div className="px-6 py-12 text-center">
        <CalendarCheck2 className="mx-auto mb-3 size-8 text-slate-300" />
        <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
          No patient selected
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Choose a patient from the left panel to view available schedules
        </p>
      </div>
    );
  }

  // ── Booking success ────────────────────────────────────────────────────────
  if (bookingSuccess) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center bg-emerald-100">
          <svg
            className="size-7 text-emerald-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">
          Appointment Booked
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {selectedPatient.patient.fullName} with Dr.{" "}
          {selectedPatient.doctor.fullName}
        </p>
        <p className="mt-0.5 text-xs font-bold text-orange-700">
          {formatDate(selectedDate)} · {selectedTime}
        </p>
        <button
          onClick={onReset}
          className="mt-5 bg-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-orange-700"
        >
          Book Another
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Doctor summary strip */}
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-orange-100 bg-orange-50 text-xs font-extrabold text-orange-700">
            {selectedPatient.doctor.fullName
              .split(" ")
              .slice(0, 2)
              .map((p) => p[0])
              .join("")}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">
              Dr. {selectedPatient.doctor.fullName}
            </p>
            {selectedPatient.doctor.specialtyName && (
              <p className="text-[11px] text-slate-400">
                {selectedPatient.doctor.specialtyName}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {/* ── Schedule Selection ── */}
        <div className="px-6 py-5">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            Available Schedules
          </p>

          {schedulesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-slate-100" />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-xs text-slate-400">
              No active schedules found for this specialist.
            </p>
          ) : (
            <div className="space-y-2">
              {schedules.map((schedule) => {
                const isSelected = selectedSchedule?.id === schedule.id;
                return (
                  <button
                    key={schedule.id}
                    onClick={() => onSelectSchedule(schedule)}
                    className={`w-full border px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                      isSelected
                        ? "border-orange-300 bg-orange-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-bold ${isSelected ? "text-orange-800" : "text-slate-900"}`}
                        >
                          {getDayNamesFromRecurrence(schedule.recurrence)}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500">
                            <Clock className="mr-0.5 inline size-3" />
                            {schedule.slotTemplate.length} slot
                            {schedule.slotTemplate.length !== 1 ? "s" : ""}
                          </span>
                          {schedule.practiceLocation?.name && (
                            <span className="text-xs text-slate-500">
                              <MapPin className="mr-0.5 inline size-3" />
                              {schedule.practiceLocation.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="bg-orange-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white">
                          Selected
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Date Selection ── */}
        {selectedSchedule && (
          <div className="px-6 py-5">
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Select Date
            </p>
            {availableDates.length === 0 ? (
              <p className="text-xs text-slate-400">
                No upcoming dates for this schedule.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableDates.slice(0, 14).map((date) => (
                  <button
                    key={date}
                    onClick={() => {
                      onSetDate(date);
                      onSetTime("");
                    }}
                    className={`border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-orange-50 ${
                      selectedDate === date
                        ? "border-orange-300 bg-orange-50 text-orange-800"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {formatDate(date)}
                  </button>
                ))}
                {availableDates.length > 14 && (
                  <span className="self-center text-xs text-slate-400">
                    +{availableDates.length - 14} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Time Selection ── */}
        {selectedSchedule && selectedDate && (
          <div className="px-6 py-5">
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Select Time
            </p>
            {availableSlots.length === 0 ? (
              <p className="text-xs text-slate-400">No time slots available.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => onSetTime(slot)}
                    className={`border px-4 py-1.5 text-xs font-bold transition-colors hover:bg-orange-50 ${
                      selectedTime === slot
                        ? "border-orange-300 bg-orange-50 text-orange-800"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Error ── */}
        {bookingError && (
          <div className="px-6 py-3">
            <p className="text-xs font-bold text-rose-700">{bookingError}</p>
          </div>
        )}

        {/* ── Confirm Button ── */}
        {selectedSchedule && (
          <div className="bg-slate-50 px-6 py-4">
            {selectedDate && selectedTime && (
              <p className="mb-2 text-[11px] font-medium text-slate-500">
                <Clock className="mr-1 inline size-3" />
                {formatDate(selectedDate)} · {selectedTime}
              </p>
            )}
            <button
              onClick={onBook}
              disabled={!selectedDate || !selectedTime || bookingLoading}
              className="w-full bg-orange-600 py-4 text-sm font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {bookingLoading ? "Booking..." : "Confirm Appointment"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
