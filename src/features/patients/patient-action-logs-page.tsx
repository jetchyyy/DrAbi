import { ClipboardList, Pencil, Trash2 } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { formatDateTimeLabel } from '../../lib/utils';
import { usePatientActionLogs } from './hooks/use-patients';

export function PatientActionLogsPage() {
  const { data: logs = [] } = usePatientActionLogs();

  return (
    <div className="space-y-6">
      <div className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 bg-slate-950 p-2.5 text-white">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Patient Activity</p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Patient Edit and Delete Logs</h1>
              <p className="mt-1 text-sm text-slate-500">
                This log keeps only the important action summary, affected patient, actor, and key changed fields.
              </p>
            </div>
          </div>
          <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest">
            {logs.length} log{logs.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50">
            <ClipboardList className="size-6 text-slate-600" />
          </div>
          <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-slate-950">No patient logs yet</p>
          <p className="max-w-xs text-xs leading-relaxed text-slate-500">
            Important edit and delete actions for patient records will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Action</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Patient</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actor</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Important Details</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Changed Fields</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr className="transition-colors hover:bg-slate-50" key={log.id}>
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 text-white ${log.action === 'edit' ? 'bg-orange-600' : 'bg-rose-600'}`}>
                          {log.action === 'edit' ? <Pencil className="size-4" /> : <Trash2 className="size-4" />}
                        </div>
                        <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest" intent={log.action === 'edit' ? 'info' : 'danger'}>
                          {log.action}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <p className="font-bold text-slate-950">{log.patientName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{log.patientId}</p>
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-600">{log.actorName}</td>
                    <td className="px-6 py-4 align-top text-sm text-slate-600">{log.summary}</td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {log.fields.map((field) => (
                          <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest" key={field}>
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-600">{formatDateTimeLabel(log.createdAt)}</td>
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
