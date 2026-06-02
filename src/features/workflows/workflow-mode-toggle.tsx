import { CalendarCheck2, UserRoundPlus } from "lucide-react";

import { cn } from "../../lib/utils";

type WorkflowMode = "walk_in" | "online_bookings";

export function WorkflowModeToggle({
  mode,
  onWalkIn,
  onOnlineBookings,
}: {
  mode: WorkflowMode;
  onWalkIn: () => void;
  onOnlineBookings: () => void;
}) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
      <button
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
          mode === "walk_in"
            ? "bg-white text-slate-950 shadow-sm"
            : "text-slate-500 hover:text-slate-700",
        )}
        onClick={onWalkIn}
        type="button"
      >
        <UserRoundPlus className="size-4" />
        Teleconsult / Walk-in
      </button>
      <button
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
          mode === "online_bookings"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700",
        )}
        onClick={onOnlineBookings}
        type="button"
      >
        <CalendarCheck2 className="size-4" />
        Online Bookings
      </button>
    </div>
  );
}
