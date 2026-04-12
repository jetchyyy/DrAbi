import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, FlaskConical, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FormField } from '../../../components/forms/form-field';
import { Button } from '../../../components/ui/button';
import { FeedbackModal } from '../../../components/ui/feedback-modal';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { createLabOrder, deleteLabOrder, getDatabase, listLabOrders, updateLabOrder } from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import { LabStatusPill } from './lab-status-pill';

const labOrderSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  labServiceId: z.string().min(1, 'Lab service is required.'),
  requestedBy: z.string().min(1, 'Requesting doctor is required.'),
  status: z.enum(['requested', 'collected', 'processing', 'ready', 'released']),
  notes: z.string().min(2, 'Request notes must be at least 2 characters.'),
  resultSummary: z.string().min(2, 'Result summary must be at least 2 characters.'),
  urgentFlag: z.boolean(),
});

type LabOrderForm = z.infer<typeof labOrderSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

export function WorkflowTab() {
  const database = getDatabase();
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({ queryKey: queryKeys.laboratory, queryFn: async () => listLabOrders() });
  const [search, setSearch] = useState('');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);

  const createMutation = useMutation({
    mutationFn: async (values: LabOrderForm) =>
      createLabOrder(
        {
          patientId: values.patientId,
          appointmentId: null,
          labServiceId: values.labServiceId,
          requestedBy: values.requestedBy,
          status: values.status,
          notes: values.notes,
          urgentFlag: values.urgentFlag,
        },
        values.resultSummary,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.laboratory }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ orderId, values }: { orderId: string; values: LabOrderForm }) => {
      const existingOrder = orders.find((entry) => entry.id === orderId);
      return updateLabOrder(
        orderId,
        {
          patientId: values.patientId,
          appointmentId: existingOrder?.appointmentId ?? null,
          labServiceId: values.labServiceId,
          requestedBy: values.requestedBy,
          status: values.status,
          notes: values.notes,
          schedDate: existingOrder?.schedDate ?? null,
          schedTime: existingOrder?.schedTime ?? null,
          urgentFlag: values.urgentFlag,
        },
        values.resultSummary,
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.laboratory }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteLabOrder(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.laboratory }),
  });

  const form = useForm<LabOrderForm>({
    resolver: zodResolver(labOrderSchema),
    defaultValues: {
      patientId: database.patients[0]?.id ?? '',
      labServiceId: database.labServices[0]?.id ?? '',
      requestedBy: database.users.find((u) => u.role === 'doctor')?.id ?? '',
      status: 'requested',
      notes: '',
      resultSummary: '',
      urgentFlag: false,
    },
  });

  const filteredOrders = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    return orders.filter((order) => {
      const patient = database.patients.find((p) => p.id === order.patientId);
      const labService = database.labServices.find((s) => s.id === order.labServiceId);
      return `${patient?.firstName ?? ''} ${patient?.lastName ?? ''} ${labService?.name ?? ''} ${order.status} ${order.notes}`
        .toLowerCase()
        .includes(q);
    });
  }, [database.labServices, database.patients, deferredSearch, orders]);

  useEffect(() => {
    if (!isOrderModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOrderModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOrderModalOpen]);

  const openCreateModal = () => {
    form.reset({
      patientId: database.patients[0]?.id ?? '',
      labServiceId: database.labServices[0]?.id ?? '',
      requestedBy: database.users.find((u) => u.role === 'doctor')?.id ?? '',
      status: 'requested',
      notes: '',
      resultSummary: '',
      urgentFlag: false,
    });
    setEditingOrderId(null);
    setIsOrderModalOpen(true);
  };

  const openEditModal = (orderId: string) => {
    const order = orders.find((entry) => entry.id === orderId);
    const result = database.labResults.find((entry) => entry.labOrderId === orderId);
    if (!order) {
      return;
    }

    form.reset({
      patientId: order.patientId,
      labServiceId: order.labServiceId,
      requestedBy: order.requestedBy,
      status: order.status,
      notes: order.notes,
      resultSummary: result?.resultSummary ?? '',
      urgentFlag: order.urgentFlag ?? false,
    });
    setEditingOrderId(orderId);
    setIsOrderModalOpen(true);
  };

  const closeOrderModal = () => {
    setEditingOrderId(null);
    setIsOrderModalOpen(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingOrderId) {
        await updateMutation.mutateAsync({ orderId: editingOrderId, values });
        setFeedbackModal({
          open: true,
          title: 'Lab order updated',
          message: 'The laboratory order was updated successfully.',
          variant: 'success',
        });
      } else {
        await createMutation.mutateAsync(values);
        setFeedbackModal({
          open: true,
          title: 'Lab order created',
          message: 'The new lab order was added successfully.',
          variant: 'success',
        });
      }

      closeOrderModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingOrderId ? 'Unable to update lab order' : 'Unable to create lab order',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the lab order.',
        variant: 'error',
      });
    }
  });

  const handleDeleteOrder = async (orderId: string) => {
    const isConfirmed = window.confirm('Delete this laboratory order?');
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(orderId);
      setFeedbackModal({
        open: true,
        title: 'Lab order deleted',
        message: 'The laboratory order was removed successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to delete lab order',
        message: error instanceof Error ? error.message : 'Something went wrong while deleting the lab order.',
        variant: 'error',
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-violet-700 p-2.5 text-white">
                <FlaskConical className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700">Laboratory Workflow</p>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-950">Lab Orders</h2>
                <p className="mt-1 text-sm text-slate-500">Track and manage laboratory orders from one workflow table.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-none bg-violet-700 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-violet-800" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                New order
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search patient, lab service, or status"
                  value={search}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
            <span className="text-xs font-bold text-slate-500">{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Service</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Patient</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Schedule</th>
                  <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-sm text-slate-400" colSpan={5}>
                      No lab orders yet.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const patient = database.patients.find((p) => p.id === order.patientId);
                    const labService = database.labServices.find((s) => s.id === order.labServiceId);

                    return (
                      <tr className="transition-colors hover:bg-slate-50" key={order.id}>
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-slate-950">{labService?.name}</p>
                            {order.urgentFlag ? <AlertTriangle className="size-3.5 text-rose-500" /> : null}
                          </div>
                          {order.notes ? <p className="mt-1 text-xs italic text-slate-400">{order.notes}</p> : null}
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-slate-600">
                          {patient?.firstName} {patient?.lastName}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <LabStatusPill status={order.status} />
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-slate-600">
                          {order.schedDate ? `${order.schedDate} ${order.schedTime ?? ''}`.trim() : 'Not scheduled'}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                            <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(order.id)} type="button">
                              <Pencil className="size-3.5" />
                              Edit
                            </button>
                            <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteOrder(order.id)} type="button">
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isOrderModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeOrderModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-violet-700 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-violet-200">Lab Order</p>
                <p className="text-sm font-bold text-white mt-0.5">{editingOrderId ? 'Edit Lab Request' : 'Create Lab Request'}</p>
              </div>
              <button
                aria-label="Close lab order modal"
                className="inline-flex shrink-0 items-center justify-center border border-violet-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeOrderModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="px-6 py-5 space-y-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient &amp; Provider</p>
                  <FormField error={form.formState.errors.patientId?.message} label="Patient">
                    <Select {...form.register('patientId')}>
                      {database.patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField error={form.formState.errors.requestedBy?.message} label="Requested by">
                    <Select {...form.register('requestedBy')}>
                      {database.users.filter((u) => u.role === 'doctor').map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                <div className="px-6 py-5 space-y-4 border-t border-slate-100">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Order Details</p>
                  <FormField error={form.formState.errors.labServiceId?.message} label="Lab service">
                    <Select {...form.register('labServiceId')}>
                      {database.labServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField error={form.formState.errors.status?.message} label="Status">
                    <Select {...form.register('status')}>
                      <option value="requested">Requested</option>
                      <option value="collected">Collected</option>
                      <option value="processing">Processing</option>
                      <option value="ready">Ready</option>
                      <option value="released">Released</option>
                    </Select>
                  </FormField>
                  <FormField error={form.formState.errors.notes?.message} label="Request notes">
                    <Textarea {...form.register('notes')} />
                  </FormField>
                  <FormField error={form.formState.errors.resultSummary?.message} label="Result summary">
                    <Textarea {...form.register('resultSummary')} />
                  </FormField>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-rose-500" {...form.register('urgentFlag')} />
                    <span className="text-sm font-medium text-slate-700">Mark as urgent</span>
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeOrderModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button className="w-full rounded-none bg-violet-700 hover:bg-violet-800 font-extrabold uppercase tracking-widest text-sm py-3 sm:w-auto" disabled={createMutation.isPending || updateMutation.isPending} type="submit">
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingOrderId ? 'Save Lab Order' : 'Save Lab Order'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <FeedbackModal
        autoCloseMs={3000}
        message={feedbackModal.message}
        onClose={closeFeedbackModal}
        open={feedbackModal.open}
        title={feedbackModal.title}
        variant={feedbackModal.variant}
      />
    </>
  );
}
