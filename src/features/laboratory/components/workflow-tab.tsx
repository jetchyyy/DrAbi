import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Camera, FileUp, FlaskConical, Paperclip, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';

import { FormField } from '../../../components/forms/form-field';
import { Button } from '../../../components/ui/button';
import { FeedbackModal } from '../../../components/ui/feedback-modal';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { useAuth } from '../../auth/auth-context';
import {
  useCancelLabRequest,
  useClinicLabQueue,
  useCompleteLabRequest,
  useCreateLabRequest,
  useDoctorLabRequests,
  useStartLabProcessing,
  useUpdateLabRequestDetails,
} from '../../lab-requests/hooks/use-lab-requests';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { LabStatusPill } from './lab-status-pill';

const labOrderSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  serviceId: z.string().min(1, 'Lab service is required.'),
  serviceCategory: z.string().min(1, 'Service category is required.'),
  requestedBy: z.string().min(1, 'Requesting doctor is required.'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  notes: z.string().optional(),
  resultSummary: z.string().optional(),
  urgentFlag: z.boolean(),
});

type LabOrderForm = z.infer<typeof labOrderSchema>;

interface OptionItem {
  id: string;
  name: string;
  category?: string;
}

interface ProfileListRow {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
}

interface MedicalServiceListRow {
  id: string;
  name: string;
  category: string;
  clinic_id: string | null;
}

interface ClinicListRow {
  id: string;
  name: string;
}

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

function buildName(profile: {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
}) {
  if (profile.full_name?.trim()) {
    return profile.full_name;
  }

  const parts = [profile.first_name, profile.last_name].filter((value): value is string => Boolean(value && value.trim()));
  return parts.join(' ') || 'Unnamed';
}

export function WorkflowTab() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'patient';
  const canCreateRequests = role === 'doctor' || role === 'owner_admin';
  const canProcessRequests = role === 'lab_staff' || role === 'owner_admin';
  const hasDualAccess = canCreateRequests && canProcessRequests;
  const [search, setSearch] = useState('');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [resultAttachments, setResultAttachments] = useState<File[]>([]);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const deferredSearch = useDeferredValue(search);
  const { data: availableClinics = [], error: clinicsError } = useQuery({
    queryKey: ['lab-form-clinics'],
    queryFn: async () => {
      if (!supabase) {
        return [] as ClinicListRow[];
      }

      const { data, error } = await supabase.from('clinics').select('id, name').order('name', { ascending: true });
      if (error) {
        throw error;
      }

      return (data ?? []) as ClinicListRow[];
    },
    enabled: Boolean(isSupabaseConfigured),
  });

  const resolvedClinicId = canCreateRequests || canProcessRequests
    ? availableClinics[0]?.id ?? null
    : null;
  const { data: queueOrders = [], isLoading: queueLoading } = useClinicLabQueue(canProcessRequests ? resolvedClinicId : null);
  const { data: doctorOrders = [], isLoading: doctorOrdersLoading } = useDoctorLabRequests(canCreateRequests ? profile?.id ?? null : null);
  const orders = useMemo(() => {
    if (hasDualAccess) {
      const mergedOrders = [...queueOrders, ...doctorOrders];
      return mergedOrders.filter((order, index) => mergedOrders.findIndex((candidate) => candidate.id === order.id) === index);
    }

    return canProcessRequests ? queueOrders : doctorOrders;
  }, [canProcessRequests, doctorOrders, hasDualAccess, queueOrders]);
  const ordersLoading = hasDualAccess ? queueLoading || doctorOrdersLoading : canProcessRequests ? queueLoading : doctorOrdersLoading;

  const createMutation = useCreateLabRequest();
  const startMutation = useStartLabProcessing();
  const updateDetailsMutation = useUpdateLabRequestDetails();
  const completeMutation = useCompleteLabRequest();
  const cancelMutation = useCancelLabRequest();

  const { data: patientOptions = [] } = useQuery({
    queryKey: ['lab-form-patients'],
    queryFn: async () => {
      if (!supabase) {
        return [] as OptionItem[];
      }

      let query = supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .eq('role', 'patient')
        .eq('is_active', true);

      const { data, error } = await query.order('full_name', { ascending: true });
      if (error) {
        throw error;
      }

      return ((data ?? []) as ProfileListRow[]).map((item) => ({
        id: item.id,
        name: buildName(item),
      }));
    },
    enabled: Boolean(isSupabaseConfigured),
  });

  const { data: doctorOptions = [] } = useQuery({
    queryKey: ['lab-form-doctors'],
    queryFn: async () => {
      if (!supabase) {
        return [] as OptionItem[];
      }

      let query = supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .eq('role', 'doctor')
        .eq('is_active', true);

      const { data, error } = await query.order('full_name', { ascending: true });
      if (error) {
        throw error;
      }

      return ((data ?? []) as ProfileListRow[]).map((item) => ({
        id: item.id,
        name: buildName(item),
      }));
    },
    enabled: Boolean(isSupabaseConfigured),
  });

  const { data: serviceOptions = [] } = useQuery({
    queryKey: ['lab-form-services', resolvedClinicId],
    queryFn: async () => {
      if (!supabase) {
        return [] as OptionItem[];
      }

      let query = supabase
        .from('medical_services')
        .select('id, name, category, clinic_id')
        .eq('department', 'Laboratory')
        .eq('is_active', true);

      if (resolvedClinicId) {
        query = query.or(`clinic_id.eq.${resolvedClinicId},clinic_id.is.null`);
      }

      const { data, error } = await query.order('name', { ascending: true });
      if (error) {
        throw error;
      }

      return ((data ?? []) as MedicalServiceListRow[]).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
      }));
    },
    enabled: Boolean(isSupabaseConfigured),
  });

  const form = useForm<LabOrderForm>({
    resolver: zodResolver(labOrderSchema),
    defaultValues: {
      patientId: '',
      serviceId: '',
      serviceCategory: '',
      requestedBy: profile?.id ?? '',
      status: 'pending',
      notes: '',
      resultSummary: '',
      urgentFlag: false,
    },
  });

  useEffect(() => {
    if (doctorOptions.length === 0 && serviceOptions.length === 0 && patientOptions.length === 0) {
      return;
    }

    const currentService = form.getValues('serviceId');
    const firstService = serviceOptions[0];
    const selectedService = serviceOptions.find((item) => item.id === currentService) ?? firstService;

    form.reset({
      patientId: form.getValues('patientId') || patientOptions[0]?.id || '',
      serviceId: selectedService?.id ?? '',
      serviceCategory: selectedService?.category ?? '',
      requestedBy: form.getValues('requestedBy') || profile?.id || doctorOptions[0]?.id || '',
      status: form.getValues('status') || 'pending',
      notes: form.getValues('notes') || '',
      resultSummary: form.getValues('resultSummary') || '',
      urgentFlag: form.getValues('urgentFlag') || false,
    });
  }, [doctorOptions, form, patientOptions, profile?.id, serviceOptions]);

  useEffect(() => {
    const subscription = form.watch((values, meta) => {
      if (meta.name !== 'serviceId') {
        return;
      }

      const selected = serviceOptions.find((item) => item.id === values.serviceId);
      if (selected) {
        form.setValue('serviceCategory', selected.category ?? '', { shouldValidate: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [form, serviceOptions]);

  const filteredOrders = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    return orders.filter((order) => {
      return `${order.patientName ?? ''} ${order.serviceName ?? ''} ${order.status} ${order.patientNotes ?? ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [deferredSearch, orders]);

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

  useEffect(() => {
    const videoElement = videoPreviewRef.current;
    if (!videoElement || !cameraStreamRef.current) {
      return;
    }

    videoElement.srcObject = cameraStreamRef.current;
    void videoElement.play().catch(() => {
      setCameraError('Unable to start camera preview.');
    });
  }, [isCameraModalOpen]);

  useEffect(() => {
    return () => {
      if (!cameraStreamRef.current) {
        return;
      }

      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, []);

  const openCreateModal = () => {
    const firstService = serviceOptions[0];
    form.reset({
      patientId: patientOptions[0]?.id ?? '',
      serviceId: firstService?.id ?? '',
      serviceCategory: firstService?.category ?? '',
      requestedBy: profile?.id ?? doctorOptions[0]?.id ?? '',
      status: 'pending',
      notes: '',
      resultSummary: '',
      urgentFlag: false,
    });
    setEditingOrderId(null);
    setResultAttachments([]);
    setIsOrderModalOpen(true);
  };

  const openEditModal = (orderId: string) => {
    const order = orders.find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }

    form.reset({
      patientId: order.patientId,
      serviceId: order.serviceId,
      serviceCategory: order.serviceCategory,
      requestedBy: order.requestedBy,
      status: order.status === 'pending' || order.status === 'in_progress' || order.status === 'completed' || order.status === 'cancelled' ? order.status : 'pending',
      notes: order.patientNotes ?? '',
      resultSummary: order.resultData ?? '',
      urgentFlag: order.urgentFlag,
    });
    setEditingOrderId(orderId);
    setResultAttachments([]);
    setIsOrderModalOpen(true);
  };

  const closeOrderModal = () => {
    setEditingOrderId(null);
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraError(null);
    setIsCameraModalOpen(false);
    setIsOrderModalOpen(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const isProcessingExistingOrder = Boolean(editingOrderId && canProcessRequests);
  const showCreationFields = canCreateRequests && !isProcessingExistingOrder;
  const workflowModeLabel = hasDualAccess ? 'Administrator mode' : canProcessRequests ? 'Lab staff mode' : canCreateRequests ? 'Doctor mode' : 'Read-only mode';
  const modalTitle = isProcessingExistingOrder
    ? 'Process Lab Request'
    : canCreateRequests
      ? 'Create Lab Request'
      : 'Review Lab Request';
  const submitLabel = (() => {
    if (
      createMutation.isPending ||
      startMutation.isPending ||
      updateDetailsMutation.isPending ||
      completeMutation.isPending ||
      cancelMutation.isPending
    ) {
      return 'Saving...';
    }

    if (isProcessingExistingOrder) {
      return 'Update Request';
    }

    if (canCreateRequests) {
      return 'Save Lab Order';
    }

    return 'Update Request';
  })();

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isProcessingExistingOrder && editingOrderId) {
        if (values.status === 'in_progress') {
          await startMutation.mutateAsync(editingOrderId);
          await updateDetailsMutation.mutateAsync({
            requestId: editingOrderId,
            status: 'in_progress',
            patientNotes: values.notes ?? '',
            urgentFlag: values.urgentFlag,
          });
        } else if (values.status === 'pending') {
          await updateDetailsMutation.mutateAsync({
            requestId: editingOrderId,
            status: 'pending',
            patientNotes: values.notes ?? '',
            urgentFlag: values.urgentFlag,
          });
        } else if (values.status === 'completed') {
          await completeMutation.mutateAsync({
            requestId: editingOrderId,
            resultData: values.resultSummary ?? '',
            resultNotes: values.notes ?? '',
            attachments: resultAttachments,
          });
        } else if (values.status === 'cancelled') {
          await cancelMutation.mutateAsync({
            requestId: editingOrderId,
            reason: values.notes ?? '',
          });
        }

        setFeedbackModal({
          open: true,
          title: 'Lab order updated',
          message: 'The laboratory order was updated successfully.',
          variant: 'success',
        });
      } else if (canCreateRequests) {
        await createMutation.mutateAsync({
          clinicId: resolvedClinicId,
          patientId: values.patientId,
          requestedBy: values.requestedBy,
          serviceId: values.serviceId,
          serviceCategory: values.serviceCategory,
          patientNotes: values.notes ?? '',
          urgentFlag: values.urgentFlag,
        });

        setFeedbackModal({
          open: true,
          title: 'Lab order created',
          message: 'The new lab order was added successfully.',
          variant: 'success',
        });
      } else {
        setFeedbackModal({
          open: true,
          title: 'Action not allowed',
          message: 'Your role can process requests but cannot create new doctor orders here.',
          variant: 'error',
        });
      }

      closeOrderModal();
      setResultAttachments([]);
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
    const isConfirmed = window.confirm('Cancel this laboratory request?');
    if (!isConfirmed) {
      return;
    }

    try {
      await cancelMutation.mutateAsync({ requestId: orderId, reason: 'Cancelled from laboratory workflow.' });
      setFeedbackModal({
        open: true,
        title: 'Lab request cancelled',
        message: 'The laboratory request was cancelled successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to cancel lab request',
        message: error instanceof Error ? error.message : 'Something went wrong while cancelling the lab request.',
        variant: 'error',
      });
    }
  };

  const appendResultAttachments = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setResultAttachments((currentFiles) => [...currentFiles, ...files]);
    event.target.value = '';
  };

  const closeCameraModal = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }

    setCameraError(null);
    setIsCameraModalOpen(false);
  };

  const openCameraModal = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedbackModal({
        open: true,
        title: 'Camera unavailable',
        message: 'This browser or device does not support direct camera capture.',
        variant: 'error',
      });
      return;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      });

      cameraStreamRef.current = stream;
      setIsCameraModalOpen(true);
    } catch {
      setFeedbackModal({
        open: true,
        title: 'Camera unavailable',
        message: 'Camera access was denied or no camera was detected on this device.',
        variant: 'error',
      });
    }
  };

  const capturePhoto = async () => {
    const videoElement = videoPreviewRef.current;
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      setCameraError('Camera preview is not ready yet.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Unable to capture image from camera.');
      return;
    }

    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((createdBlob) => resolve(createdBlob), 'image/jpeg', 0.92);
    });

    if (!blob) {
      setCameraError('Unable to encode captured image.');
      return;
    }

    const filename = `lab-result-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    const file = new File([blob], filename, { type: 'image/jpeg' });
    setResultAttachments((currentFiles) => [...currentFiles, file]);
    closeCameraModal();
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
              {canCreateRequests ? (
                <Button className="rounded-none bg-violet-700 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-violet-800" onClick={openCreateModal}>
                  <Plus className="mr-2 size-4" />
                  New order
                </Button>
              ) : null}
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
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {workflowModeLabel}
            </span>
          </div>
          {!isSupabaseConfigured ? (
            <div className="border-t border-amber-200 bg-amber-50 px-6 py-3 text-xs font-semibold text-amber-700">
              Supabase is not configured. This screen requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
            </div>
          ) : null}
          {clinicsError ? (
            <div className="border-t border-rose-200 bg-rose-50 px-6 py-3 text-xs font-semibold text-rose-700">
              Unable to load clinic scope: {clinicsError instanceof Error ? clinicsError.message : 'Unknown clinics query error.'}
            </div>
          ) : null}
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
                      {ordersLoading ? 'Loading lab orders...' : 'No lab orders yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    return (
                      <tr className="transition-colors hover:bg-slate-50" key={order.id}>
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-slate-950">{order.serviceName ?? order.serviceCategory}</p>
                            {order.urgentFlag ? <AlertTriangle className="size-3.5 text-rose-500" /> : null}
                          </div>
                          {order.patientNotes ? <p className="mt-1 text-xs italic text-slate-400">{order.patientNotes}</p> : null}
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-slate-600">
                          {order.patientName ?? order.patientId}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <LabStatusPill status={order.status} />
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-slate-600">
                          {order.completedAt ? new Date(order.completedAt).toLocaleString() : 'Not completed'}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                            {canProcessRequests ? (
                              <>
                                <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(order.id)} type="button">
                                  <Pencil className="size-3.5" />
                                  Process
                                </button>
                                <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteOrder(order.id)} type="button">
                                  <Trash2 className="size-3.5" />
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Doctor submitted</span>
                            )}
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

      {isOrderModalOpen && (canCreateRequests || canProcessRequests) ? (
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
                <p className="text-sm font-bold text-white mt-0.5">{modalTitle}</p>
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
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    {showCreationFields ? 'Patient &amp; Provider' : 'Request Processing'}
                  </p>
                  {showCreationFields ? (
                    <>
                      <FormField error={form.formState.errors.patientId?.message} label="Patient">
                        <Select {...form.register('patientId')}>
                          {patientOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField error={form.formState.errors.requestedBy?.message} label="Requested by">
                        <Select {...form.register('requestedBy')}>
                          {doctorOptions.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Lab staff can update request status and result notes, but cannot create doctor requests here.
                    </div>
                  )}
                </div>
                <div className="px-6 py-5 space-y-4 border-t border-slate-100">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Order Details</p>
                  {showCreationFields ? (
                    <>
                      <FormField error={form.formState.errors.serviceId?.message} label="Lab service">
                        <Select {...form.register('serviceId')}>
                          {serviceOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <input type="hidden" {...form.register('serviceCategory')} />
                    </>
                  ) : null}
                  <FormField error={form.formState.errors.status?.message} label="Status">
                    <Select {...form.register('status')}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                  </FormField>
                  <FormField error={form.formState.errors.notes?.message} label="Request notes">
                    <Textarea {...form.register('notes')} />
                  </FormField>
                  <FormField error={form.formState.errors.resultSummary?.message} label="Result summary">
                    <Textarea {...form.register('resultSummary')} />
                  </FormField>
                  {isProcessingExistingOrder ? (
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-white p-2 text-violet-700 shadow-sm">
                          <Paperclip className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">Result attachments</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Upload result images or documents before completing the request.
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex cursor-pointer items-center gap-2 border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-50/40">
                          <FileUp className="size-4 text-violet-600" />
                          <span>Choose files</span>
                          <input
                            accept="image/*,application/pdf,.doc,.docx"
                            className="hidden"
                            multiple
                            onChange={appendResultAttachments}
                            type="file"
                          />
                        </label>
                        <button
                          className="flex items-center gap-2 border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                          onClick={() => void openCameraModal()}
                          type="button"
                        >
                          <Camera className="size-4 text-emerald-600" />
                          <span>Camera</span>
                        </button>
                      </div>
                      {resultAttachments.length > 0 ? (
                        <div className="space-y-2">
                          {resultAttachments.map((file) => (
                            <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                              <span className="min-w-0 flex-1 truncate">{file.name}</span>
                              <span className="text-xs uppercase tracking-widest text-slate-400">{Math.round(file.size / 1024)} KB</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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
                {canCreateRequests || canProcessRequests ? (
                  <Button
                    className="w-full rounded-none bg-violet-700 hover:bg-violet-800 font-extrabold uppercase tracking-widest text-sm py-3 sm:w-auto"
                    disabled={
                      createMutation.isPending ||
                      startMutation.isPending ||
                      updateDetailsMutation.isPending ||
                      completeMutation.isPending ||
                      cancelMutation.isPending
                    }
                    type="submit"
                  >
                    {submitLabel}
                  </Button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCameraModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"
          onClick={closeCameraModal}
          role="dialog"
        >
          <div
            className="w-full max-w-2xl overflow-hidden border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-emerald-700 px-6 py-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-200">Capture Result</p>
                <p className="mt-0.5 text-sm font-bold text-white">Use Device Camera</p>
              </div>
              <button
                aria-label="Close camera capture"
                className="inline-flex items-center justify-center border border-emerald-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeCameraModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="overflow-hidden border border-slate-200 bg-black">
                <video className="h-auto w-full" muted playsInline ref={videoPreviewRef} />
              </div>
              {cameraError ? (
                <p className="text-sm font-medium text-rose-600">{cameraError}</p>
              ) : null}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeCameraModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button className="w-full rounded-none bg-emerald-700 text-sm font-extrabold uppercase tracking-widest hover:bg-emerald-800 sm:w-auto" onClick={() => void capturePhoto()} type="button">
                  Capture photo
                </Button>
              </div>
            </div>
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
