import { Stethoscope } from "lucide-react";
import { cn, formatCurrency } from "../../../lib/utils";
import type { SpecialistItem } from "../hooks/use-referral";

interface SpecialistListProps {
  specialists: SpecialistItem[];
  selectedId: string | null;
  onSelect: (specialist: SpecialistItem) => void;
  isLoading?: boolean;
}

export function SpecialistList({
  specialists,
  selectedId,
  onSelect,
  isLoading,
}: SpecialistListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (specialists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Stethoscope className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No specialists found</p>
        <p className="mt-1 text-xs">
          Make sure specialist accounts have been created.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {specialists.map((specialist) => {
        const isSelected = selectedId === specialist.id;
        return (
          <button
            key={specialist.id}
            type="button"
            onClick={() => onSelect(specialist)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-accent",
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card",
            )}
          >
            <div className="flex w-full items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Stethoscope className="h-4 w-4" />
              </div>
              <span className="truncate text-sm font-semibold leading-tight">
                {specialist.fullName}
              </span>
            </div>

            {specialist.specialtyName && (
              <span className="ml-10 text-xs text-muted-foreground">
                {specialist.specialtyName}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
