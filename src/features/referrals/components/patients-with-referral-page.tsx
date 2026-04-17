import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

import type { PatientWithReferral } from "../hooks/use-referral-frontdesk";

interface PatientsWithReferralsPageProps {
  patients: PatientWithReferral[];
  selectedPatient: PatientWithReferral | null;
  loading: boolean;
  error: string | null;
  onSelectPatient: (patient: PatientWithReferral) => void;
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Pagination
  currentPage: number;
  totalPages: number;
  filteredCount: number;
  onPageChange: (page: number) => void;
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
  searchQuery,
  onSearchChange,
  currentPage,
  totalPages,
  filteredCount,
  onPageChange,
}: PatientsWithReferralsPageProps) {
  // ── Search bar (always visible unless initial load) ──────────────────────
  const searchBar = !loading && !error && (
    <div className="border-b border-slate-100 px-4 py-3">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-3.5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search patient or doctor…"
          className="w-full rounded-none border border-slate-200 bg-slate-50 py-2 pl-8 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-200"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 text-slate-400 transition-colors hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  // ── Loading skeleton ──────────────────────────────────────────────────────
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

  // ── Error state ───────────────────────────────────────────────────────────
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

  // ── Empty (no referrals at all, not a search miss) ────────────────────────
  if (filteredCount === 0 && !searchQuery) {
    return (
      <>
        {searchBar}
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
            No referrals found
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Patients with active referrals will appear here
          </p>
        </div>
      </>
    );
  }

  // ── Pagination controls ───────────────────────────────────────────────────
  const paginationControls = totalPages > 1 && (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
      <p className="text-[11px] text-slate-400">
        Page {currentPage} of {totalPages}
        {searchQuery && (
          <span className="ml-1 text-orange-500">
            · {filteredCount} result{filteredCount !== 1 ? "s" : ""}
          </span>
        )}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex h-6 w-6 items-center justify-center border border-slate-200 text-slate-500 transition-colors hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {/* Page number pills */}
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => {
            // Always show first, last, current ± 1
            return (
              p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
            );
          })
          .reduce<(number | "…")[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
            acc.push(p);
            return acc;
          }, [])
          .map((item, idx) =>
            item === "…" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1 text-[11px] text-slate-400"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item as number)}
                className={`flex h-6 min-w-[24px] items-center justify-center border px-1.5 text-[11px] font-bold transition-colors ${
                  currentPage === item
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-600"
                }`}
              >
                {item}
              </button>
            ),
          )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex h-6 w-6 items-center justify-center border border-slate-200 text-slate-500 transition-colors hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {searchBar}

      {/* ── No search results ─────────────────────────────────────────────── */}
      {filteredCount === 0 && searchQuery ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
            No results
          </p>
          <p className="mt-1 text-xs text-slate-400">
            No patients match &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {patients.map((patient) => {
            const isSelected =
              selectedPatient?.referralId === patient.referralId;
            return (
              <button
                key={patient.referralId}
                onClick={() => onSelectPatient(patient)}
                className={`w-full px-6 py-4 text-left transition-colors hover:bg-slate-50 ${
                  isSelected ? "bg-orange-50" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {/* Avatar */}
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
      )}

      {paginationControls}
    </div>
  );
}
