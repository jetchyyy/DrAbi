import { Plus, Pencil, Trash2, X, FlaskConical, Link2, Unlink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '../../../components/ui/button';
import { FeedbackModal } from '../../../components/ui/feedback-modal';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import {
  INTERNAL_SURFACE,
  INTERNAL_TABLE,
  INTERNAL_TABLE_SCROLL,
  INTERNAL_TD,
  INTERNAL_TH,
  INTERNAL_TR,
  INTERNAL_THEAD_ROW,
} from '../../../lib/internal-ui';
import { cn } from '../../../lib/utils';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import {
  listTestParameters,
  createTestParameter,
  updateTestParameter,
  deleteTestParameter,
  listReagentLinks,
  createReagentLink,
  deleteReagentLink,
} from '../lis-service';
import type { LabTestParameter, LabParameterDataType, LabReagentLink } from '../lis-types';

interface TestParametersModalProps {
  serviceId: string;
  serviceName: string;
  open: boolean;
  onClose: () => void;
}

interface FeedbackState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

const DATA_TYPES: { value: LabParameterDataType; label: string }[] = [
  { value: 'numeric', label: 'Numeric' },
  { value: 'text', label: 'Free Text' },
  { value: 'select', label: 'Dropdown' },
];

const EMPTY_FORM = {
  parameterName: '',
  unit: '',
  dataType: 'numeric' as LabParameterDataType,
  sortOrder: 0,
  referenceRangeGeneralLow: '',
  referenceRangeGeneralHigh: '',
  referenceRangeMaleLow: '',
  referenceRangeMaleHigh: '',
  referenceRangeFemaleLow: '',
  referenceRangeFemaleHigh: '',
  selectOptions: '',
};

interface InventoryItemOption {
  id: string;
  name: string;
  unit: string;
}

export function TestParametersModal({ serviceId, serviceName, open, onClose }: TestParametersModalProps) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'parameters' | 'reagents'>('parameters');
  const [feedback, setFeedback] = useState<FeedbackState>({ open: false, title: '', message: '', variant: 'success' });
  const [reagentItemId, setReagentItemId] = useState('');
  const [reagentQty, setReagentQty] = useState('1');

  const { data: parameters = [], isLoading } = useQuery({
    queryKey: ['lis-test-parameters', serviceId],
    queryFn: () => listTestParameters(serviceId),
    enabled: open && Boolean(serviceId),
  });

  const { data: reagentLinks = [] } = useQuery({
    queryKey: ['lis-reagent-links', serviceId],
    queryFn: () => listReagentLinks(serviceId),
    enabled: open && Boolean(serviceId) && activeTab === 'reagents',
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-items-for-reagents'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('inventory_items').select('id, name, unit').order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InventoryItemOption[];
    },
    enabled: open && activeTab === 'reagents' && isSupabaseConfigured,
  });

  const createMutation = useMutation({
    mutationFn: (input: typeof EMPTY_FORM) =>
      createTestParameter({
        medicalServiceId: serviceId,
        parameterName: input.parameterName,
        unit: input.unit,
        dataType: input.dataType,
        sortOrder: input.sortOrder,
        referenceRangeGeneralLow: input.referenceRangeGeneralLow ? Number(input.referenceRangeGeneralLow) : null,
        referenceRangeGeneralHigh: input.referenceRangeGeneralHigh ? Number(input.referenceRangeGeneralHigh) : null,
        referenceRangeMaleLow: input.referenceRangeMaleLow ? Number(input.referenceRangeMaleLow) : null,
        referenceRangeMaleHigh: input.referenceRangeMaleHigh ? Number(input.referenceRangeMaleHigh) : null,
        referenceRangeFemaleLow: input.referenceRangeFemaleLow ? Number(input.referenceRangeFemaleLow) : null,
        referenceRangeFemaleHigh: input.referenceRangeFemaleHigh ? Number(input.referenceRangeFemaleHigh) : null,
        selectOptions: input.selectOptions ? input.selectOptions.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lis-test-parameters', serviceId] });
      setFeedback({ open: true, title: 'Parameter added', message: 'Test parameter was created successfully.', variant: 'success' });
      setIsFormOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (error) => setFeedback({ open: true, title: 'Error', message: error instanceof Error ? error.message : 'Failed to create parameter.', variant: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: typeof EMPTY_FORM }) =>
      updateTestParameter(id, {
        parameterName: input.parameterName,
        unit: input.unit,
        dataType: input.dataType,
        sortOrder: input.sortOrder,
        referenceRangeGeneralLow: input.referenceRangeGeneralLow ? Number(input.referenceRangeGeneralLow) : null,
        referenceRangeGeneralHigh: input.referenceRangeGeneralHigh ? Number(input.referenceRangeGeneralHigh) : null,
        referenceRangeMaleLow: input.referenceRangeMaleLow ? Number(input.referenceRangeMaleLow) : null,
        referenceRangeMaleHigh: input.referenceRangeMaleHigh ? Number(input.referenceRangeMaleHigh) : null,
        referenceRangeFemaleLow: input.referenceRangeFemaleLow ? Number(input.referenceRangeFemaleLow) : null,
        referenceRangeFemaleHigh: input.referenceRangeFemaleHigh ? Number(input.referenceRangeFemaleHigh) : null,
        selectOptions: input.selectOptions ? input.selectOptions.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lis-test-parameters', serviceId] });
      setFeedback({ open: true, title: 'Parameter updated', message: 'Test parameter was saved.', variant: 'success' });
      setIsFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: (error) => setFeedback({ open: true, title: 'Error', message: error instanceof Error ? error.message : 'Failed to update.', variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTestParameter(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lis-test-parameters', serviceId] });
      setFeedback({ open: true, title: 'Parameter removed', message: 'Test parameter was deactivated.', variant: 'success' });
    },
  });

  const addReagentMutation = useMutation({
    mutationFn: () =>
      createReagentLink({
        medicalServiceId: serviceId,
        inventoryItemId: reagentItemId,
        quantityPerTest: Number(reagentQty) || 1,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lis-reagent-links', serviceId] });
      setFeedback({ open: true, title: 'Reagent linked', message: 'Inventory item was linked to this test.', variant: 'success' });
      setReagentItemId('');
      setReagentQty('1');
    },
    onError: (error) => setFeedback({ open: true, title: 'Error', message: error instanceof Error ? error.message : 'Failed to link reagent.', variant: 'error' }),
  });

  const removeReagentMutation = useMutation({
    mutationFn: (id: string) => deleteReagentLink(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lis-reagent-links', serviceId] });
      setFeedback({ open: true, title: 'Reagent unlinked', message: 'Reagent link was removed.', variant: 'success' });
    },
  });

  const openEditForm = (param: LabTestParameter) => {
    setEditingId(param.id);
    setForm({
      parameterName: param.parameterName,
      unit: param.unit,
      dataType: param.dataType,
      sortOrder: param.sortOrder,
      referenceRangeGeneralLow: param.referenceRangeGeneralLow?.toString() ?? '',
      referenceRangeGeneralHigh: param.referenceRangeGeneralHigh?.toString() ?? '',
      referenceRangeMaleLow: param.referenceRangeMaleLow?.toString() ?? '',
      referenceRangeMaleHigh: param.referenceRangeMaleHigh?.toString() ?? '',
      referenceRangeFemaleLow: param.referenceRangeFemaleLow?.toString() ?? '',
      referenceRangeFemaleHigh: param.referenceRangeFemaleHigh?.toString() ?? '',
      selectOptions: param.selectOptions.join(', '),
    });
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.parameterName.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: form });
    } else {
      createMutation.mutate(form);
    }
  };

  useEffect(() => {
    if (!open) {
      setIsFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  }, [open]);

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
          className="my-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 bg-emerald-600 px-6 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">LIS Configuration</p>
              <p className="mt-0.5 text-sm font-bold text-white">{serviceName}</p>
            </div>
            <button
              aria-label="Close"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={onClose}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 px-6">
            <button
              type="button"
              className={cn(
                'px-4 py-3 text-[11px] font-semibold uppercase tracking-wide transition border-b-2',
                activeTab === 'parameters' ? 'border-emerald-600 text-emerald-900' : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
              onClick={() => setActiveTab('parameters')}
            >
              <FlaskConical className="inline-block mr-1.5 size-3.5" />
              Test Parameters
            </button>
            <button
              type="button"
              className={cn(
                'px-4 py-3 text-[11px] font-semibold uppercase tracking-wide transition border-b-2',
                activeTab === 'reagents' ? 'border-emerald-600 text-emerald-900' : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
              onClick={() => setActiveTab('reagents')}
            >
              <Link2 className="inline-block mr-1.5 size-3.5" />
              Reagent Links
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'parameters' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">{parameters.length} parameter{parameters.length !== 1 ? 's' : ''} configured</p>
                  <Button
                    className="bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    onClick={() => {
                      setEditingId(null);
                      setForm({ ...EMPTY_FORM, sortOrder: parameters.length });
                      setIsFormOpen(true);
                    }}
                  >
                    <Plus className="mr-1 size-3.5" /> Add Parameter
                  </Button>
                </div>

                {/* Parameter Form */}
                {isFormOpen && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{editingId ? 'Edit' : 'New'} Parameter</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-500">Name *</label>
                        <Input value={form.parameterName} onChange={(e) => setForm({ ...form, parameterName: e.target.value })} placeholder="e.g. WBC Count" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-500">Unit</label>
                        <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. 10³/µL" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-500">Data Type</label>
                        <Select value={form.dataType} onChange={(e) => setForm({ ...form, dataType: e.target.value as LabParameterDataType })}>
                          {DATA_TYPES.map((dt) => (
                            <option key={dt.value} value={dt.value}>{dt.label}</option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {form.dataType === 'numeric' && (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mt-2">Reference Ranges (General)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">Low</label>
                            <Input type="number" step="any" value={form.referenceRangeGeneralLow} onChange={(e) => setForm({ ...form, referenceRangeGeneralLow: e.target.value })} placeholder="e.g. 4.5" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">High</label>
                            <Input type="number" step="any" value={form.referenceRangeGeneralHigh} onChange={(e) => setForm({ ...form, referenceRangeGeneralHigh: e.target.value })} placeholder="e.g. 11.0" />
                          </div>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mt-2">Reference Ranges (Male)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">Low</label>
                            <Input type="number" step="any" value={form.referenceRangeMaleLow} onChange={(e) => setForm({ ...form, referenceRangeMaleLow: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">High</label>
                            <Input type="number" step="any" value={form.referenceRangeMaleHigh} onChange={(e) => setForm({ ...form, referenceRangeMaleHigh: e.target.value })} />
                          </div>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mt-2">Reference Ranges (Female)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">Low</label>
                            <Input type="number" step="any" value={form.referenceRangeFemaleLow} onChange={(e) => setForm({ ...form, referenceRangeFemaleLow: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">High</label>
                            <Input type="number" step="any" value={form.referenceRangeFemaleHigh} onChange={(e) => setForm({ ...form, referenceRangeFemaleHigh: e.target.value })} />
                          </div>
                        </div>
                      </>
                    )}

                    {form.dataType === 'select' && (
                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-500">Options (comma-separated)</label>
                        <Input value={form.selectOptions} onChange={(e) => setForm({ ...form, selectOptions: e.target.value })} placeholder="Positive, Negative, Trace" />
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-semibold uppercase text-slate-500">Sort Order</label>
                      <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button className="bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                        {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Add'}
                      </Button>
                      <Button variant="secondary" className="px-4 py-2 text-xs" onClick={() => { setIsFormOpen(false); setEditingId(null); setForm(EMPTY_FORM); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Parameters Table */}
                <div className={INTERNAL_SURFACE}>
                  <div className={INTERNAL_TABLE_SCROLL}>
                    <table className={INTERNAL_TABLE}>
                      <thead>
                        <tr className={INTERNAL_THEAD_ROW}>
                          <th className={INTERNAL_TH}>#</th>
                          <th className={INTERNAL_TH}>Parameter</th>
                          <th className={INTERNAL_TH}>Unit</th>
                          <th className={INTERNAL_TH}>Type</th>
                          <th className={INTERNAL_TH}>Ref. Range</th>
                          <th className={cn(INTERNAL_TH, 'text-right')}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parameters.length === 0 ? (
                          <tr className={INTERNAL_TR}>
                            <td className={cn(INTERNAL_TD, 'py-8 text-center text-sm text-slate-500')} colSpan={6}>
                              {isLoading ? 'Loading...' : 'No parameters configured yet. Click "Add Parameter" to define test components.'}
                            </td>
                          </tr>
                        ) : (
                          parameters.map((param, index) => (
                            <tr className={INTERNAL_TR} key={param.id}>
                              <td className={cn(INTERNAL_TD, 'text-xs text-slate-400 font-mono')}>{index + 1}</td>
                              <td className={cn(INTERNAL_TD, 'text-sm font-semibold text-slate-900')}>{param.parameterName}</td>
                              <td className={cn(INTERNAL_TD, 'text-sm text-slate-600')}>{param.unit || '—'}</td>
                              <td className={cn(INTERNAL_TD, 'text-[10px] font-semibold uppercase tracking-wide text-slate-500')}>
                                {DATA_TYPES.find((dt) => dt.value === param.dataType)?.label ?? param.dataType}
                              </td>
                              <td className={cn(INTERNAL_TD, 'text-xs text-slate-600')}>
                                {param.referenceRangeGeneralLow != null && param.referenceRangeGeneralHigh != null
                                  ? `${param.referenceRangeGeneralLow} – ${param.referenceRangeGeneralHigh}`
                                  : '—'}
                              </td>
                              <td className={cn(INTERNAL_TD, 'text-right')}>
                                <div className="flex items-center justify-end gap-3 text-[11px] font-semibold uppercase tracking-wide">
                                  <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditForm(param)} type="button">
                                    <Pencil className="size-3.5" /> Edit
                                  </button>
                                  <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => { if (window.confirm('Remove this parameter?')) deleteMutation.mutate(param.id); }} type="button">
                                    <Trash2 className="size-3.5" /> Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reagents' && (
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  Link inventory items (reagents, consumables) to this lab test. When a test is completed, linked reagent quantities can be tracked.
                </p>

                <div className="flex items-end gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold uppercase text-slate-500">Inventory Item</label>
                    <Select value={reagentItemId} onChange={(e) => setReagentItemId(e.target.value)}>
                      <option value="">Select item...</option>
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] font-semibold uppercase text-slate-500">Qty/Test</label>
                    <Input type="number" min="0.01" step="0.01" value={reagentQty} onChange={(e) => setReagentQty(e.target.value)} />
                  </div>
                  <Button
                    className="bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    disabled={!reagentItemId || addReagentMutation.isPending}
                    onClick={() => addReagentMutation.mutate()}
                  >
                    <Link2 className="mr-1 size-3.5" /> Link
                  </Button>
                </div>

                <div className={INTERNAL_SURFACE}>
                  <div className={INTERNAL_TABLE_SCROLL}>
                    <table className={INTERNAL_TABLE}>
                      <thead>
                        <tr className={INTERNAL_THEAD_ROW}>
                          <th className={INTERNAL_TH}>Reagent / Item</th>
                          <th className={INTERNAL_TH}>Unit</th>
                          <th className={INTERNAL_TH}>Qty per Test</th>
                          <th className={cn(INTERNAL_TH, 'text-right')}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reagentLinks.length === 0 ? (
                          <tr className={INTERNAL_TR}>
                            <td className={cn(INTERNAL_TD, 'py-8 text-center text-sm text-slate-500')} colSpan={4}>
                              No reagents linked to this test.
                            </td>
                          </tr>
                        ) : (
                          reagentLinks.map((link) => (
                            <tr className={INTERNAL_TR} key={link.id}>
                              <td className={cn(INTERNAL_TD, 'text-sm font-semibold text-slate-900')}>{link.inventoryItemName || link.inventoryItemId}</td>
                              <td className={cn(INTERNAL_TD, 'text-sm text-slate-600')}>{link.inventoryItemUnit || '—'}</td>
                              <td className={cn(INTERNAL_TD, 'text-sm text-slate-900 font-mono')}>{link.quantityPerTest}</td>
                              <td className={cn(INTERNAL_TD, 'text-right')}>
                                <button
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-rose-600 hover:underline"
                                  onClick={() => { if (window.confirm('Unlink this reagent?')) removeReagentMutation.mutate(link.id); }}
                                  type="button"
                                >
                                  <Unlink className="size-3.5" /> Unlink
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 bg-slate-50 px-6 py-4 border-t border-slate-100">
            <Button variant="secondary" onClick={onClose}>Close</Button>
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
