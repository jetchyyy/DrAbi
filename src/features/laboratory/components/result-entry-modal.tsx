import { AlertTriangle, CheckCircle2, ChevronDown, FlaskConical, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '../../../components/ui/button';
import { FeedbackModal } from '../../../components/ui/feedback-modal';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { cn } from '../../../lib/utils';
import { listTestParameters, listResultEntries, saveResultEntry, computeAbnormalFlag, insertAuditEntry, getAccession, createAccession } from '../lis-service';
import type { LabTestParameter, LabResultEntry, AbnormalFlag } from '../lis-types';
import type { LabRequestRecord } from '../../lab-requests/types';

interface ResultEntryModalProps {
  request: LabRequestRecord;
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

interface FeedbackState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

type ResultValue = {
  parameterId: string;
  valueNumeric: string;
  valueText: string;
  abnormalFlag: AbnormalFlag;
  saved: boolean;
};

const FLAG_STYLES: Record<AbnormalFlag, { bg: string; text: string; label: string }> = {
  normal: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Normal' },
  low: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Low' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'High' },
  critical: { bg: 'bg-rose-50', text: 'text-rose-800', label: 'Critical' },
};

const SPECIMEN_TYPES = [
  'Blood (Whole)', 'Blood (Serum)', 'Blood (Plasma)', 'Urine', 'Stool',
  'Sputum', 'Swab (Throat)', 'Swab (Nasal)', 'Swab (Wound)', 'CSF',
  'Synovial Fluid', 'Other',
];

export function ResultEntryModal({ request, open, onClose, onCompleted }: ResultEntryModalProps) {
  const qc = useQueryClient();
  const [resultValues, setResultValues] = useState<Map<string, ResultValue>>(new Map());
  const [feedback, setFeedback] = useState<FeedbackState>({ open: false, title: '', message: '', variant: 'success' });
  const [showAccession, setShowAccession] = useState(false);
  const [specimenType, setSpecimenType] = useState('Blood (Whole)');
  const [specimenCondition, setSpecimenCondition] = useState('adequate');
  const [accessionNotes, setAccessionNotes] = useState('');

  const { data: parameters = [] } = useQuery({
    queryKey: ['lis-test-parameters', request.serviceId],
    queryFn: () => listTestParameters(request.serviceId),
    enabled: open,
  });

  const { data: existingResults = [] } = useQuery({
    queryKey: ['lis-result-entries', request.id],
    queryFn: () => listResultEntries(request.id),
    enabled: open,
  });

  const { data: accession } = useQuery({
    queryKey: ['lis-accession', request.id],
    queryFn: () => getAccession(request.id),
    enabled: open,
  });

  // Initialize form from existing results
  useEffect(() => {
    if (parameters.length === 0) return;
    const map = new Map<string, ResultValue>();
    for (const param of parameters) {
      const existing = existingResults.find((r) => r.parameterId === param.id);
      map.set(param.id, {
        parameterId: param.id,
        valueNumeric: existing?.valueNumeric?.toString() ?? '',
        valueText: existing?.valueText ?? '',
        abnormalFlag: existing?.abnormalFlag ?? 'normal',
        saved: Boolean(existing),
      });
    }
    setResultValues(map);
  }, [parameters, existingResults]);

  const saveMutation = useMutation({
    mutationFn: async (entry: { parameterId: string; valueNumeric: string; valueText: string }) => {
      const param = parameters.find((p) => p.id === entry.parameterId);
      const numVal = entry.valueNumeric ? Number(entry.valueNumeric) : null;
      const result = await saveResultEntry({
        serviceRequestId: request.id,
        parameterId: entry.parameterId,
        valueNumeric: param?.dataType === 'numeric' ? numVal : null,
        valueText: param?.dataType !== 'numeric' ? entry.valueText : null,
      });

      await insertAuditEntry(
        request.id,
        'result_entry',
        undefined,
        `${param?.parameterName}: ${param?.dataType === 'numeric' ? numVal : entry.valueText} ${param?.unit ?? ''}`.trim(),
      );

      return result;
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['lis-result-entries', request.id] });
      setResultValues((prev) => {
        const next = new Map(prev);
        const existing = next.get(result.parameterId);
        if (existing) {
          next.set(result.parameterId, { ...existing, abnormalFlag: result.abnormalFlag, saved: true });
        }
        return next;
      });
    },
    onError: (error) => setFeedback({ open: true, title: 'Error', message: error instanceof Error ? error.message : 'Failed to save result.', variant: 'error' }),
  });

  const accessionMutation = useMutation({
    mutationFn: () =>
      createAccession({
        serviceRequestId: request.id,
        specimenType,
        specimenCondition,
        notes: accessionNotes,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lis-accession', request.id] });
      setShowAccession(false);
      setFeedback({ open: true, title: 'Specimen accessioned', message: 'Accession number has been assigned.', variant: 'success' });
    },
    onError: (error) => setFeedback({ open: true, title: 'Error', message: error instanceof Error ? error.message : 'Failed to create accession.', variant: 'error' }),
  });

  const handleValueChange = (parameterId: string, field: 'valueNumeric' | 'valueText', value: string) => {
    setResultValues((prev) => {
      const next = new Map(prev);
      const existing = next.get(parameterId);
      if (!existing) return prev;
      const updated = { ...existing, [field]: value, saved: false };

      // Auto-compute flag for numeric
      if (field === 'valueNumeric' && value) {
        const param = parameters.find((p) => p.id === parameterId);
        if (param && param.dataType === 'numeric') {
          updated.abnormalFlag = computeAbnormalFlag(
            Number(value),
            param.referenceRangeGeneralLow,
            param.referenceRangeGeneralHigh,
          );
        }
      }

      next.set(parameterId, updated);
      return next;
    });
  };

  const handleSaveAll = async () => {
    let savedCount = 0;
    for (const [, entry] of resultValues) {
      if (entry.saved) continue;
      if (!entry.valueNumeric && !entry.valueText) continue;
      await saveMutation.mutateAsync({
        parameterId: entry.parameterId,
        valueNumeric: entry.valueNumeric,
        valueText: entry.valueText,
      });
      savedCount++;
    }
    if (savedCount > 0) {
      setFeedback({ open: true, title: 'Results saved', message: `${savedCount} result${savedCount !== 1 ? 's' : ''} saved successfully.`, variant: 'success' });
    }
  };

  const allSaved = parameters.length > 0 && [...resultValues.values()].every((v) => v.saved || (!v.valueNumeric && !v.valueText));
  const hasResults = [...resultValues.values()].some((v) => v.valueNumeric || v.valueText);

  if (!open) return null;

  return (
    <>
      <div
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4"
        onClick={onClose}
        role="dialog"
      >
        <div
          className="my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">Structured Result Entry</p>
                <p className="mt-0.5 text-sm font-bold text-white">{request.serviceName ?? 'Lab Test'}</p>
                <p className="mt-0.5 text-xs text-emerald-100">
                  Patient: {request.patientName ?? 'Unknown'} · Requested by: {request.requestedByName ?? 'Unknown'}
                </p>
              </div>
              <button
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={onClose}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Accession info bar */}
            {accession ? (
              <div className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-xs text-white">
                <span className="font-bold">Accession:</span> {accession.accessionNumber} ·{' '}
                <span className="font-bold">Specimen:</span> {accession.specimenType} ·{' '}
                <span className="font-bold">Condition:</span> {accession.specimenCondition}
              </div>
            ) : (
              <button
                type="button"
                className="mt-3 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 w-full text-left"
                onClick={() => setShowAccession(!showAccession)}
              >
                <FlaskConical className="inline mr-1.5 size-3.5" />
                {showAccession ? 'Hide' : 'Accession specimen'} <ChevronDown className={cn('inline ml-1 size-3 transition', showAccession && 'rotate-180')} />
              </button>
            )}
          </div>

          {/* Accession Form */}
          {showAccession && !accession && (
            <div className="border-b border-slate-100 bg-amber-50/50 px-6 py-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Specimen Accession</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Specimen Type</label>
                  <Select value={specimenType} onChange={(e) => setSpecimenType(e.target.value)}>
                    {SPECIMEN_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Condition</label>
                  <Select value={specimenCondition} onChange={(e) => setSpecimenCondition(e.target.value)}>
                    <option value="adequate">Adequate</option>
                    <option value="insufficient">Insufficient</option>
                    <option value="hemolyzed">Hemolyzed</option>
                    <option value="lipemic">Lipemic</option>
                    <option value="clotted">Clotted</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">Notes</label>
                <Textarea value={accessionNotes} onChange={(e) => setAccessionNotes(e.target.value)} rows={2} />
              </div>
              <Button
                className="bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                disabled={accessionMutation.isPending}
                onClick={() => accessionMutation.mutate()}
              >
                {accessionMutation.isPending ? 'Assigning...' : 'Assign Accession Number'}
              </Button>
            </div>
          )}

          {/* Result Entry Form */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {parameters.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
                <FlaskConical className="mx-auto mb-3 size-8 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600">No test parameters configured</p>
                <p className="mt-1 text-xs text-slate-500">
                  Go to Catalog → Configure Parameters to define the measurable components for this test first.
                </p>
              </div>
            ) : (
              parameters.map((param) => {
                const entry = resultValues.get(param.id);
                const flag = entry?.abnormalFlag ?? 'normal';
                const flagStyle = FLAG_STYLES[flag];
                const hasRange = param.referenceRangeGeneralLow != null || param.referenceRangeGeneralHigh != null;

                return (
                  <div
                    key={param.id}
                    className={cn(
                      'rounded-xl border p-4 transition-all',
                      entry?.saved ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{param.parameterName}</p>
                          {param.unit && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{param.unit}</span>
                          )}
                          {entry?.saved && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                        </div>
                        {hasRange && (
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            Ref: {param.referenceRangeGeneralLow ?? '—'} – {param.referenceRangeGeneralHigh ?? '—'} {param.unit}
                          </p>
                        )}
                      </div>

                      {/* Abnormal flag pill */}
                      {(entry?.valueNumeric || entry?.valueText) && (
                        <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', flagStyle.bg, flagStyle.text)}>
                          {flag === 'critical' && <AlertTriangle className="inline mr-1 size-3" />}
                          {flagStyle.label}
                        </span>
                      )}
                    </div>

                    <div className="mt-2">
                      {param.dataType === 'numeric' ? (
                        <Input
                          type="number"
                          step="any"
                          value={entry?.valueNumeric ?? ''}
                          onChange={(e) => handleValueChange(param.id, 'valueNumeric', e.target.value)}
                          placeholder={`Enter value${param.unit ? ` (${param.unit})` : ''}`}
                          className={cn(
                            flag === 'critical' && 'border-rose-300 ring-1 ring-rose-200',
                            flag === 'high' && 'border-orange-300 ring-1 ring-orange-200',
                            flag === 'low' && 'border-amber-300 ring-1 ring-amber-200',
                          )}
                        />
                      ) : param.dataType === 'select' ? (
                        <Select
                          value={entry?.valueText ?? ''}
                          onChange={(e) => handleValueChange(param.id, 'valueText', e.target.value)}
                        >
                          <option value="">Select result...</option>
                          {param.selectOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </Select>
                      ) : (
                        <Textarea
                          value={entry?.valueText ?? ''}
                          onChange={(e) => handleValueChange(param.id, 'valueText', e.target.value)}
                          rows={2}
                          placeholder="Enter result..."
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <div className="text-xs text-slate-500">
              {hasResults ? (
                allSaved ? (
                  <span className="text-emerald-600 font-semibold">All results saved ✓</span>
                ) : (
                  <span className="text-amber-600 font-semibold">Unsaved changes</span>
                )
              ) : (
                <span>Enter results for each parameter</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>Close</Button>
              <Button
                className="bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                disabled={!hasResults || allSaved || saveMutation.isPending}
                onClick={handleSaveAll}
              >
                <Save className="mr-1.5 size-3.5" />
                {saveMutation.isPending ? 'Saving...' : 'Save All Results'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <FeedbackModal
        autoCloseMs={2500}
        message={feedback.message}
        onClose={() => setFeedback((s) => ({ ...s, open: false }))}
        open={feedback.open}
        title={feedback.title}
        variant={feedback.variant}
      />
    </>
  );
}
