import { ClipboardList, Pencil, Trash2 } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { formatDateTimeLabel } from "../../lib/utils";
import type { InventoryUsageLog } from "../../types/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import { getInventoryLogs } from "../../lib/supabase-clinic";

export function InventoryLogsPage() {
  const page = 1;

  const { data: logs = [] } = useQuery<InventoryUsageLog[]>({
    queryKey: [queryKeys.inventoryUsageLogs, page],
    queryFn: () => getInventoryLogs(page),
  });

  return (
    <div className="space-y-6">
      <div className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 bg-slate-950 p-2.5 text-white">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                Inventory Transaction Activity
              </p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
                Inventory Transaction Logs
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                This log keeps only the important action summary, affected by
                inventory transaction.
              </p>
            </div>
          </div>
          <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest">
            {logs.length} log{logs.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50">
            <ClipboardList className="size-6 text-slate-600" />
          </div>
          <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-slate-950">
            No inventory logs yet
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-slate-500">
            Important edit and delete actions for inventory records will appear
            here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    RecordedBy
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Appointment
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    QrCode
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4">{log.recordedBy}</td>
                    <td className="px-6 py-4">
                      {log.patientId && !log.patientId.includes("undefined")
                        ? log.patientId
                        : "Walk-in Customer"}
                    </td>
                    <td className="px-6 py-4">{log.appointmentId}</td>
                    <td className="px-6 py-4">{log.itemId}</td>
                    <td className="px-6 py-4">-{log.quantity}</td>
                    <td className="px-6 py-4">{log.notes}</td>
                    <td className="px-6 py-4">{log.scannedCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
