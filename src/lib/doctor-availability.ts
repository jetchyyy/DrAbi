import type { DoctorAvailability } from "../types/domain";

export const DOCTOR_AVAILABILITY_DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export const DOCTOR_SLOT_MINUTE_OPTIONS = [15, 30, 60] as const;

const DEFAULT_START_MINUTES = 6 * 60;
const DEFAULT_END_MINUTES = 21 * 60;

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(value: number) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatTimeLabel(value: string) {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

export function buildDailyTimeSlots(slotMinutes: number) {
  const normalizedMinutes = Math.max(15, slotMinutes || 30);
  const slots: string[] = [];

  for (
    let cursor = DEFAULT_START_MINUTES;
    cursor < DEFAULT_END_MINUTES;
    cursor += normalizedMinutes
  ) {
    slots.push(minutesToTime(cursor));
  }

  return slots;
}

export function toAvailabilityRowInput(
  doctorId: string,
  dayOfWeek: number,
  startTime: string,
  slotMinutes: number,
) {
  return {
    doctorId,
    dayOfWeek,
    startTime,
    endTime: minutesToTime(timeToMinutes(startTime) + slotMinutes),
    slotMinutes,
  };
}

// AFTER — expands each availability window into individual time slots
export function getAvailableTimeSlotsForDate(
  availability: DoctorAvailability[],
  date: string,
) {
  if (!date) {
    return [];
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const slots: string[] = [];

  const windows = availability
    .filter((window) => window.dayOfWeek === dayOfWeek)
    .sort(
      (left, right) =>
        timeToMinutes(left.startTime) - timeToMinutes(right.startTime),
    );

  for (const window of windows) {
    const start = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);
    const step = window.slotMinutes ?? 30;

    for (let cursor = start; cursor < end; cursor += step) {
      slots.push(minutesToTime(cursor));
    }
  }

  return slots;
}

export function filterPastTimeSlots(slots: string[], date: string): string[] {
  const today = new Date().toISOString().slice(0, 10);

  if (date !== today) {
    return slots;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return slots.filter((slot) => timeToMinutes(slot) > currentMinutes);
}
