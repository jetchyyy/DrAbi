import { useDeferredValue, useMemo, useState } from 'react';
import { ClipboardList, Pencil, Search, Trash2 } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { formatDateTimeLabel } from '../../lib/utils';
import { usePatientActionLogs } from './hooks/use-patients';

export function PatientActionLogsPage() {
  const { data: logs = [] } = usePatientActionLogs();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const filteredLogs = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((log) =>
      [log.patientName, log.actorName, log.summary, log.action, ...(log.fields ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [deferredSearch, logs]);

  const editCount = useMemo(() => logs.filter((l) => l.action === 'edit').length, [logs]);
  const deleteCount = useMemo(() => logs.filter((l) => l.action === 'delete').length, [logs]);

  return (
    <div className="space-y-5">
      <div className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{background:'color-mix(in srgb, var(--color-primary) 14%, white)'}}>
              <ClipboardList className="size-5" style={{color:'var(--color-primary)'}} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Patient Activity</p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Patient Edit and Delete Logs</h1>
              <p className="mt-1 text-sm text-slate-500">
                Important action summaries, affected patients, actors, and key changed fields.
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, actor, or action..."
              value={search}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-6 py-2.5">
          <span className="text-xs font-bold text-slate-500">
            {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} found
          </span>
          <span className="inline-flex items-center border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
            {editCount} edits
          </span>
          <span className="inline-flex items-center border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-red-600">
            {deleteCount} deletes
          </span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50">
            <ClipboardList className="size-6 text-slate-400" />
          </div>
          <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-slate-950">No patient logs yet</p>
          <p className="max-w-xs text-xs leading-relaxed text-slate-500">
            Important edit and delete actions for patient records will appear here.
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50">
            <Search className="size-6 text-slate-400" />
          </div>
          <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-slate-950">No logs match your search</p>
          <p className="max-w-xs text-xs leading-relaxed text-slate-500">
            Try a different patient name, actor, or action keyword.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Action</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Patient</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Actor</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Summary</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Changed Fields</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr className="transition-colors hover:bg-slate-50" key={log.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 text-white ${log.action === 'edit' ? 'bg-slate-500' : 'bg-red-600'}`}>
                          {log.action === 'edit' ? <Pencil className="size-3.5" /> : <Trash2 className="size-3.5" />}
                        </div>
                        <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest" intent={log.action === 'edit' ? 'info' : 'danger'}>
                          {log.action}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-bold text-slate-950">{log.patientName}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">{log.patientId}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-slate-600">{log.actorName}</td>
                    <td className="max-w-[240px] px-4 py-3 align-top text-sm text-slate-600">
                      <span className="line-clamp-2">{log.summary}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {log.fields.map((field) => (
                          <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest" key={field}>
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-500">{formatDateTimeLabel(log.createdAt)}</td>
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
