import { CalendarClock, CheckCircle2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { DoctorAvailability } from "../../../types/domain";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function generateSlots(
  start: string,
  end: string,
  slotMinutes: number,
): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);
  let current = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;

  while (current + slotMinutes <= endTotal) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    slots.push(label);
    current += slotMinutes;
  }

  return slots;
}

function formatSlotLabel(time: string): string {
  const [hourStr, minStr] = time.split(":");
  const hour = Number(hourStr);
  const min = minStr;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${min} ${period}`;
}

export interface ScheduleSlot {
  dayOfWeek: number;
  time: string;
  scheduledAt: string;
}

interface ScheduleListProps {
  availability: DoctorAvailability[];
  selectedSlot: ScheduleSlot | null;
  onSelect: (slot: ScheduleSlot) => void;
  targetDate?: string | null;
  isLoading?: boolean;
}

export function ScheduleList({
  availability,
  selectedSlot,
  onSelect,
  targetDate,
  isLoading,
}: ScheduleListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (availability.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <CalendarClock className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No availability configured</p>
        <p className="mt-1 text-xs">
          The selected specialist has no schedule set up.
        </p>
      </div>
    );
  }

  const getScheduledAt = (dayOfWeek: number, time: string): string => {
    if (targetDate) {
      return `${targetDate}T${time}:00`;
    }

    const now = new Date();
    const todayDay = now.getDay();
    const daysUntil = (dayOfWeek - todayDay + 7) % 7 || 7;
    const target = new Date(now);
    target.setDate(now.getDate() + daysUntil);
    const dateStr = target.toISOString().slice(0, 10);
    return `${dateStr}T${time}:00`;
  };

  return (
    <div className="flex flex-col gap-4">
      {availability.map((avail) => {
        const slots = generateSlots(
          avail.startTime,
          avail.endTime,
          avail.slotMinutes,
        );
        const dayName = DAYS[avail.dayOfWeek] ?? `Day ${avail.dayOfWeek}`;

        return (
          <div
            key={avail.id}
            className="rounded-lg border border-border bg-card"
          >
            <div className="border-b border-border px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {dayName}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {avail.startTime} – {avail.endTime} · {avail.slotMinutes}min
                slots
              </span>
            </div>

            <div className="flex flex-wrap gap-2 p-4">
              {slots.map((time) => {
                const scheduledAt = getScheduledAt(avail.dayOfWeek, time);
                const isSelected =
                  selectedSlot?.dayOfWeek === avail.dayOfWeek &&
                  selectedSlot?.time === time;

                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() =>
                      onSelect({
                        dayOfWeek: avail.dayOfWeek,
                        time,
                        scheduledAt,
                      })
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent",
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-3 w-3" />}
                    {formatSlotLabel(time)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
