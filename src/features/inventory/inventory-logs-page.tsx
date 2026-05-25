import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { InternalPage } from "../../components/ui/internal-page";
import {
  INTERNAL_SEARCH_INPUT_WRAP,
  INTERNAL_SURFACE,
  INTERNAL_SURFACE_FOOTER,
  INTERNAL_TABLE,
  INTERNAL_TABLE_SCROLL,
  INTERNAL_TD,
  INTERNAL_TH,
  INTERNAL_TR,
  INTERNAL_THEAD_ROW,
} from "../../lib/internal-ui";
import { queryKeys } from "../../lib/query-keys";
import { cn } from "../../lib/utils";
import {
  getInventoryLogs,
  getInventoryLogsCount,
} from "../../lib/supabase-clinic";
import { formatDateTimeLabel } from "../../lib/utils";
import type { InventoryUsageLog } from "../../types/domain";

function formatLogTimestamp(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return formatDateTimeLabel(value);
}

function formatPatientName(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase().includes("undefined")) {
    return "Walk-in Customer";
  }

  return normalized;
}

export function InventoryLogsContent() {
  const INVENTORY_LOGS_PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data: totalLogs = 0 } = useQuery<number>({
    queryKey: [queryKeys.inventoryUsageLogs, "count"],
    queryFn: getInventoryLogsCount,
  });

  const totalPages = Math.max(
    1,
    Math.ceil(totalLogs / INVENTORY_LOGS_PAGE_SIZE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const { data: logs = [] } = useQuery<InventoryUsageLog[]>({
    queryKey: [queryKeys.inventoryUsageLogs, safeCurrentPage],
    queryFn: () => getInventoryLogs(safeCurrentPage),
  });

  const filteredLogs = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return logs;
    }

    return logs.filter((log) =>
      [
        log.recordedBy,
        formatPatientName(log.patientId),
        log.appointmentId ?? "",
        log.itemId,
        log.notes,
        log.scannedCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [deferredSearch, logs]);
  const showingStart =
    totalLogs === 0 ? 0 : (safeCurrentPage - 1) * INVENTORY_LOGS_PAGE_SIZE + 1;
  const showingEnd =
    totalLogs === 0
      ? 0
      : Math.min(safeCurrentPage * INVENTORY_LOGS_PAGE_SIZE, totalLogs);

  return (
    <>
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm ring-1 ring-slate-800">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Inventory transaction activity
              </p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Inventory transaction logs
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Review deducted item usage history and trace transactions quickly.
              </p>
            </div>
          </div>

          <div className="flex w-full max-w-xl flex-wrap items-center justify-end gap-3">
            <div className={`${INTERNAL_SEARCH_INPUT_WRAP} w-full min-w-[240px] max-w-sm`}>
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search record, patient, item, or QR code"
                value={search}
              />
            </div>
            <Badge className="rounded-full border border-slate-200/90 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm">
              {totalLogs} total
            </Badge>
          </div>
        </div>
      </section>

      {totalLogs === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200/90 bg-white p-12 text-center shadow-[0_1px_2px_rgba(15,41,71,0.04)]">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 shadow-inner">
            <ClipboardList className="size-6 text-slate-600" />
          </div>
          <p className="mb-1 text-sm font-bold text-slate-900">
            No inventory logs yet
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-slate-500">
            Inventory transaction entries will appear here after item usage is recorded.
          </p>
        </div>
      ) : (
        <section className={INTERNAL_SURFACE}>
          <div className={INTERNAL_TABLE_SCROLL}>
            <table className={INTERNAL_TABLE}>
              <thead>
                <tr className={INTERNAL_THEAD_ROW}>
                  <th className={cn(INTERNAL_TH, "whitespace-nowrap")}>
                    Recorded
                  </th>
                  <th className={cn(INTERNAL_TH, "whitespace-nowrap")}>
                    Recorded By
                  </th>
                  <th className={cn(INTERNAL_TH, "whitespace-nowrap")}>
                    Patient
                  </th>
                  <th className={cn(INTERNAL_TH, "whitespace-nowrap")}>
                    Item
                  </th>
                  <th className={cn(INTERNAL_TH, "whitespace-nowrap")}>
                    Qty
                  </th>
                  <th className={cn(INTERNAL_TH, "whitespace-nowrap")}>
                    Notes
                  </th>
                  <th className={cn(INTERNAL_TH, "whitespace-nowrap")}>
                    QR Code
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr className={INTERNAL_TR}>
                    <td
                      className={cn(INTERNAL_TD, "py-10 text-center text-sm text-slate-500")}
                      colSpan={7}
                    >
                      No logs match this search.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr className={INTERNAL_TR} key={log.id}>
                      <td className={cn(INTERNAL_TD, "whitespace-nowrap text-xs text-slate-600")}>
                        {formatLogTimestamp(log.createdAt)}
                      </td>
                      <td className={cn(INTERNAL_TD, "font-mono text-xs text-slate-700")}>
                        {log.recordedBy || "—"}
                      </td>
                      <td className={cn(INTERNAL_TD, "text-xs text-slate-700")}>
                        {formatPatientName(log.patientId)}
                      </td>
                      <td className={cn(INTERNAL_TD, "text-xs text-slate-700")}>
                        {log.itemId || "—"}
                      </td>
                      <td className={INTERNAL_TD}>
                        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800 ring-1 ring-rose-100">
                          -{log.quantity}
                        </span>
                      </td>
                      <td
                        className={cn(INTERNAL_TD, "max-w-[260px] text-sm text-slate-700")}
                        title={log.notes || ""}
                      >
                        <span className="block truncate">
                          {log.notes || "—"}
                        </span>
                      </td>
                      <td className={cn(INTERNAL_TD, "font-mono text-xs text-slate-700")}>
                        {log.scannedCode || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div
            className={cn(
              INTERNAL_SURFACE_FOOTER,
              "flex flex-wrap items-center justify-between gap-3 px-5 py-3",
            )}
          >
            <p className="text-xs font-medium text-slate-600">
              Showing {showingStart}-{showingEnd} of {totalLogs} logs
            </p>
            <div className="flex items-center gap-2">
              <Button
                className="rounded-lg border border-slate-200/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide shadow-sm"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                type="button"
                variant="secondary"
              >
                Previous
              </Button>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <Button
                className="rounded-lg border border-slate-200/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide shadow-sm"
                disabled={safeCurrentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                type="button"
                variant="secondary"
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export function InventoryLogsPage() {
  return (
    <InternalPage>
      <InventoryLogsContent />
    </InternalPage>
  );
}
