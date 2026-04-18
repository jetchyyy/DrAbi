import { useMemo, useState } from "react";
import { CalendarCheck2, Clock, ChevronLeft, ChevronRight } from "lucide-react";

import type {
  PatientWithReferral,
  SpecialistSchedule,
} from "../hooks/use-referral-frontdesk";

// ─── Time Helpers ─────────────────────────────────────────────────────────────

/** Strip seconds, remove leading zero from hour: "07:00:00" → "7:00" */
function normalizeTime(raw: string): string {
  const hhmm = raw.length > 5 ? raw.slice(0, 5) : raw;
  const [hStr, mStr] = hhmm.split(":");
  return `${parseInt(hStr, 10)}:${mStr}`;
}

/** "7:00" → "7:00 AM", "13:30" → "1:30 PM" */
function formatTimeDisplay(normalized: string): string {
  const [hStr, mStr] = normalized.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${mStr} ${suffix}`;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ─── PH Time (UTC+8) ──────────────────────────────────────────────────────────

function getTodayPH(): string {
  const now = new Date();
  const phMs = now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000;
  return new Date(phMs).toISOString().slice(0, 10);
}

function getNowTimePH(): string {
  const now = new Date();
  const phMs = now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000;
  const ph = new Date(phMs);
  return `${ph.getHours()}:${String(ph.getMinutes()).padStart(2, "0")}`;
}

// ─── Recurrence Mapping ───────────────────────────────────────────────────────
// DB:  0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun
// JS getUTCDay(): 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
const DB_TO_JS_DAY: Record<number, number> = {
  0: 1, // Mon → JS 1
  1: 2, // Tue → JS 2
  2: 3, // Wed → JS 3
  3: 4, // Thu → JS 4
  4: 5, // Fri → JS 5
  5: 6, // Sat → JS 6
  6: 0, // Sun → JS 0
};

/**
 * Returns available dates (YYYY-MM-DD) for a schedule.
 * Uses millisecond arithmetic + getUTCDay() — never affected by local timezone.
 */
function getAvailableDatesForSchedule(
  schedule: SpecialistSchedule,
  daysAhead = 90,
): string[] {
  const todayPH = getTodayPH();
  const [ty, tm, td] = todayPH.split("-").map(Number);
  const todayUtcMs = Date.UTC(ty, tm - 1, td);

  let startUtcMs = todayUtcMs;
  if (schedule.validFrom) {
    const [vy, vm, vd] = schedule.validFrom.slice(0, 10).split("-").map(Number);
    const validFromMs = Date.UTC(vy, vm - 1, vd);
    if (validFromMs > todayUtcMs) startUtcMs = validFromMs;
  }

  const results: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const ms = startUtcMs + i * 86400000;
    const jsDay = new Date(ms).getUTCDay();
    if (schedule.recurrence.some((r) => DB_TO_JS_DAY[r] === jsDay)) {
      results.push(new Date(ms).toISOString().slice(0, 10));
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

function formatMonthYear(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
  bookedSlots?: { date: string; time: string }[];
  onSelectSchedule: (schedule: SpecialistSchedule) => void;
  onSetDate: (date: string) => void;
  onSetTime: (time: string) => void;
  onBook: () => void;
  onReset: () => void;
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

interface MiniCalendarProps {
  dateToSchedule: Map<string, SpecialistSchedule>;
  selectedDate: string;
  onSelectDate: (date: string, schedule: SpecialistSchedule) => void;
  schedulesLoading: boolean;
}

const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function MiniCalendar({
  dateToSchedule,
  selectedDate,
  onSelectDate,
  schedulesLoading,
}: MiniCalendarProps) {
  const todayPH = getTodayPH();
  const [ty, tm] = todayPH.split("-").map(Number);

  const [viewYear, setViewYear] = useState(
    selectedDate ? parseInt(selectedDate.slice(0, 4)) : ty,
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate ? parseInt(selectedDate.slice(5, 7)) - 1 : tm - 1,
  );

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  // getUTCDay so the first weekday of the month is never shifted by local timezone
  const firstDayUtcJs = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(viewYear, viewMonth + 1, 0),
  ).getUTCDate();
  const startOffset = (firstDayUtcJs + 6) % 7; // 0=Mon offset

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  if (schedulesLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 border border-slate-200 hover:bg-slate-100 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-3.5 text-slate-500" />
        </button>
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
          {formatMonthYear(viewYear, viewMonth)}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 border border-slate-200 hover:bg-slate-100 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="size-3.5 text-slate-500" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-bold text-slate-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;

          const mm = String(viewMonth + 1).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          const dateStr = `${viewYear}-${mm}-${dd}`;

          const schedule = dateToSchedule.get(dateStr);
          const isAvailable = !!schedule;
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === todayPH;
          const isPast = dateStr < todayPH;

          return (
            <div key={dateStr} className="flex flex-col items-center py-0.5">
              <button
                disabled={!isAvailable || isPast}
                onClick={() =>
                  isAvailable && !isPast && onSelectDate(dateStr, schedule!)
                }
                className={[
                  "w-8 h-8 text-xs font-bold transition-colors",
                  isSelected
                    ? "bg-orange-600 text-white"
                    : isToday && !isSelected
                      ? "border border-orange-300 text-orange-700 hover:bg-orange-50"
                      : isAvailable && !isPast
                        ? "text-slate-800 hover:bg-orange-50 hover:text-orange-700"
                        : "text-slate-300 cursor-default",
                ].join(" ")}
              >
                {day}
              </button>
              {isAvailable && !isPast && (
                <span
                  className={`w-1 h-1 rounded-full mt-0.5 ${
                    isSelected ? "bg-orange-300" : "bg-orange-500"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-slate-400 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
        Dates with available slots
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  bookedSlots = [],
  onSelectSchedule,
  onSetDate,
  onSetTime,
  onBook,
  onReset,
}: SpecialistScheduleListPageProps) {
  /**
   * Merge all schedules into Map<YYYY-MM-DD, SpecialistSchedule>.
   * Clicking a date automatically resolves which schedule to use.
   */
  const dateToSchedule = useMemo<Map<string, SpecialistSchedule>>(() => {
    const map = new Map<string, SpecialistSchedule>();
    for (const schedule of schedules) {
      for (const date of getAvailableDatesForSchedule(schedule)) {
        map.set(date, schedule);
      }
    }
    return map;
  }, [schedules]);

  /** Slots for the currently resolved schedule, normalized "H:MM" */
  const availableSlots = useMemo(() => {
    if (!selectedSchedule) return [];
    return selectedSchedule.slotTemplate.map((s) => normalizeTime(s.start));
  }, [selectedSchedule]);

  /** Booked-slot lookup set keyed "YYYY-MM-DD|H:MM" */
  const bookedSlotsSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookedSlots) {
      set.add(`${b.date}|${normalizeTime(b.time)}`);
    }
    return set;
  }, [bookedSlots]);

  const todayPH = getTodayPH();
  const nowTimePH = normalizeTime(getNowTimePH());

  function getSlotState(
    slot: string,
  ): "available" | "past" | "booked" | "selected" {
    if (selectedTime === slot) return "selected";
    if (bookedSlotsSet.has(`${selectedDate}|${slot}`)) return "booked";
    if (selectedDate === todayPH && toMinutes(slot) <= toMinutes(nowTimePH))
      return "past";
    return "available";
  }

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
          {formatDate(selectedDate)} · {formatTimeDisplay(selectedTime)}
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
        {/* ── Calendar — no schedule pills, just click a date ── */}
        <div className="px-6 py-5">
          <p className="mb-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            Select Date
          </p>
          {!schedulesLoading && schedules.length === 0 ? (
            <p className="text-xs text-slate-400">
              No active schedules found for this specialist.
            </p>
          ) : (
            <MiniCalendar
              dateToSchedule={dateToSchedule}
              selectedDate={selectedDate}
              onSelectDate={(date, schedule) => {
                onSelectSchedule(schedule);
                onSetDate(date);
                onSetTime("");
              }}
              schedulesLoading={schedulesLoading}
            />
          )}
        </div>

        {/* ── Time Slots (appear once date is selected) ── */}
        {selectedSchedule && selectedDate && (
          <div className="px-6 py-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Available Time Slots
              </p>
              <span className="text-[10px] font-bold text-orange-600">
                {formatDate(selectedDate)}
              </span>
            </div>

            {/* Legend */}
            <div className="mb-3 flex items-center gap-4">
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                Available
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-300" />
                Past / Booked
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                Selected
              </span>
            </div>

            {availableSlots.length === 0 ? (
              <p className="text-xs text-slate-400">No time slots available.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {availableSlots.map((slot) => {
                  const state = getSlotState(slot);
                  const isDisabled = state === "past" || state === "booked";
                  const isSelected = state === "selected";
                  const isPastOrBooked = state === "past" || state === "booked";

                  return (
                    <button
                      key={slot}
                      disabled={isDisabled}
                      onClick={() => !isDisabled && onSetTime(slot)}
                      className={[
                        "border px-3 py-3 text-xs font-bold transition-colors text-center",
                        isSelected
                          ? "border-orange-300 bg-orange-50 text-orange-800"
                          : isPastOrBooked
                            ? "border-rose-100 bg-rose-50 text-rose-300 cursor-not-allowed"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700",
                      ].join(" ")}
                    >
                      {formatTimeDisplay(slot)}
                    </button>
                  );
                })}
              </div>
            )}

            {availableSlots.length > 0 &&
              availableSlots.every((s) => {
                const st = getSlotState(s);
                return st === "past" || st === "booked";
              }) && (
                <p className="mt-3 text-[11px] text-slate-400">
                  Only available slots can be selected. Past times and booked
                  slots are blocked.
                </p>
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
                {formatDate(selectedDate)} · {formatTimeDisplay(selectedTime)}
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
