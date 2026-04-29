import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { queryKeys } from '../../lib/query-keys';
import { getInventoryLogs, getInventoryLogsCount } from '../../lib/supabase-clinic';
import { formatDateTimeLabel } from '../../lib/utils';
import type { InventoryUsageLog } from '../../types/domain';

function formatLogTimestamp(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return formatDateTimeLabel(value);
}

function formatPatientName(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase().includes('undefined')) {
    return 'Walk-in Customer';
  }

  return normalized;
}

export function InventoryLogsPage() {
  const INVENTORY_LOGS_PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const { data: totalLogs = 0 } = useQuery<number>({
    queryKey: [queryKeys.inventoryUsageLogs, 'count'],
    queryFn: getInventoryLogsCount,
  });

  const totalPages = Math.max(1, Math.ceil(totalLogs / INVENTORY_LOGS_PAGE_SIZE));
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
        log.appointmentId ?? '',
        log.itemId,
        log.notes,
        log.scannedCode,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [deferredSearch, logs]);
  const showingStart = totalLogs === 0 ? 0 : (safeCurrentPage - 1) * INVENTORY_LOGS_PAGE_SIZE + 1;
  const showingEnd = totalLogs === 0 ? 0 : Math.min(safeCurrentPage * INVENTORY_LOGS_PAGE_SIZE, totalLogs);

  return (
    <div className="space-y-6">
      <div className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 bg-slate-950 p-2.5 text-white">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Inventory Transaction Activity</p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Inventory Transaction Logs</h1>
              <p className="mt-1 text-sm text-slate-500">Review deducted item usage history and trace transactions quickly.</p>
            </div>
          </div>

          <div className="flex w-full max-w-xl flex-wrap items-center justify-end gap-3">
            <div className="flex w-full min-w-[240px] max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search record, patient, item, or QR code"
                value={search}
              />
            </div>
            <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest">
              {totalLogs} total
            </Badge>
          </div>
        </div>
      </div>

      {totalLogs === 0 ? (
        <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50">
            <ClipboardList className="size-6 text-slate-600" />
          </div>
          <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-slate-950">No inventory logs yet</p>
          <p className="max-w-xs text-xs leading-relaxed text-slate-500">
            Inventory transaction entries will appear here after item usage is recorded.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Recorded</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Recorded By</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Patient</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Appointment</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Item</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Qty</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Notes</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">QR Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={8}>
                      No logs match this search.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr className="transition-colors hover:bg-slate-50" key={log.id}>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-600">{formatLogTimestamp(log.createdAt)}</td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-slate-700">{log.recordedBy || '—'}</td>
                      <td className="px-4 py-3 align-top text-xs text-slate-700">{formatPatientName(log.patientId)}</td>
                      <td className="px-4 py-3 align-top text-xs text-slate-700">{log.appointmentId || '—'}</td>
                      <td className="px-4 py-3 align-top text-xs text-slate-700">{log.itemId || '—'}</td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex items-center bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                          -{log.quantity}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 align-top text-sm text-slate-700" title={log.notes || ''}>
                        <span className="block truncate">{log.notes || '—'}</span>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-slate-700">{log.scannedCode || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">
              Showing {showingStart}-{showingEnd} of {totalLogs} logs
            </p>
            <div className="flex items-center gap-2">
              <Button
                className="rounded-none border-slate-300 px-3 py-1 text-xs font-bold uppercase tracking-wide"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                type="button"
                variant="secondary"
              >
                Previous
              </Button>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <Button
                className="rounded-none border-slate-300 px-3 py-1 text-xs font-bold uppercase tracking-wide"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                type="button"
                variant="secondary"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
