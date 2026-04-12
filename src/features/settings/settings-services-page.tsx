import { zodResolver } from '@hookform/resolvers/zod';
import { BriefcaseBusiness, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { queryClient } from '../../app/query-client';
import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useServicesCatalog, useSpecialtiesCatalog } from '../../hooks/use-clinic-data';
import { queryKeys } from '../../lib/query-keys';
import {
  createServiceLiveOrDemo,
  createSpecialtyLiveOrDemo,
  deleteServiceLiveOrDemo,
  deleteSpecialtyLiveOrDemo,
  updateServiceLiveOrDemo,
  updateSpecialtyLiveOrDemo,
} from '../../lib/supabase-clinic';
import { formatCurrency } from '../../lib/utils';
import type { ServiceDeliveryMode, ServiceType, Specialty } from '../../types/domain';

const serviceSchema = z.object({
  serviceType: z.enum(['medical_service', 'consultation', 'follow_up']),
  name: z.string().min(2, 'Service name must be at least 2 characters.'),
  description: z.string().min(4, 'Description must be at least 4 characters.'),
  price: z.number().min(0, 'Price must be 0 or higher.'),
  durationMinutes: z.number().min(5, 'Duration must be at least 5 minutes.'),
  specialtyId: z.string().optional(),
  isBookable: z.enum(['true', 'false']),
  deliveryMode: z.enum(['in_person', 'teleconsultation', 'hybrid']),
});

const specialtySchema = z.object({
  name: z.string().min(2, 'Specialty name must be at least 2 characters.'),
  description: z.string().min(4, 'Description must be at least 4 characters.'),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;
type SpecialtyFormValues = z.infer<typeof specialtySchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

function formatDeliveryMode(deliveryMode?: ServiceDeliveryMode | null) {
  return (deliveryMode ?? 'hybrid').replace('_', ' ');
}

function formatServiceType(serviceType: ServiceType) {
  if (serviceType === 'consultation') return 'Consultation';
  if (serviceType === 'follow_up') return 'Follow-up';
  return 'Medical Service';
}

export function SettingsServicesPage() {
  const { data: services = [] } = useServicesCatalog();
  const { data: specialties = [] } = useSpecialtiesCatalog();
  const [search, setSearch] = useState('');
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isSpecialtyModalOpen, setIsSpecialtyModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);

  const filteredServices = useMemo(
    () =>
      services.filter((service) =>
        `${service.name} ${service.description} ${service.serviceType} ${service.deliveryMode}`.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, services],
  );

  const filteredSpecialties = useMemo(
    () => specialties.filter((specialty) => `${specialty.name} ${specialty.description}`.toLowerCase().includes(deferredSearch.toLowerCase())),
    [deferredSearch, specialties],
  );

  const createServiceMutation = useMutation({
    mutationFn: async (values: ServiceFormValues) =>
      createServiceLiveOrDemo({
        serviceType: values.serviceType,
        name: values.name,
        description: values.description,
        price: values.price,
        durationMinutes: values.durationMinutes,
        specialtyId: values.specialtyId || null,
        isBookable: values.isBookable === 'true',
        deliveryMode: values.deliveryMode,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ServiceFormValues }) =>
      updateServiceLiveOrDemo(id, {
        serviceType: values.serviceType,
        name: values.name,
        description: values.description,
        price: values.price,
        durationMinutes: values.durationMinutes,
        specialtyId: values.specialtyId || null,
        isBookable: values.isBookable === 'true',
        deliveryMode: values.deliveryMode,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => deleteServiceLiveOrDemo(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });

  const createSpecialtyMutation = useMutation({
    mutationFn: async (values: SpecialtyFormValues) => createSpecialtyLiveOrDemo(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.specialties });
    },
  });

  const updateSpecialtyMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SpecialtyFormValues }) => updateSpecialtyLiveOrDemo(id, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.specialties });
    },
  });

  const deleteSpecialtyMutation = useMutation({
    mutationFn: async (id: string) => deleteSpecialtyLiveOrDemo(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.specialties });
    },
  });

  const serviceForm = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      serviceType: 'medical_service',
      name: '',
      description: '',
      price: 800,
      durationMinutes: 30,
      specialtyId: '',
      isBookable: 'true',
      deliveryMode: 'hybrid',
    },
  });

  const specialtyForm = useForm<SpecialtyFormValues>({
    resolver: zodResolver(specialtySchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    if (!isServiceModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsServiceModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isServiceModalOpen]);

  useEffect(() => {
    if (!isSpecialtyModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSpecialtyModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSpecialtyModalOpen]);

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({ ...currentState, open: false }));
  };

  const openCreateServiceModal = () => {
    serviceForm.reset({
      serviceType: 'medical_service',
      name: '',
      description: '',
      price: 800,
      durationMinutes: 30,
      specialtyId: specialties[0]?.id ?? '',
      isBookable: 'true',
      deliveryMode: 'hybrid',
    });
    setEditingServiceId(null);
    setIsServiceModalOpen(true);
  };

  const openEditServiceModal = (id: string) => {
    const service = services.find((item) => item.id === id);
    if (!service) return;

    serviceForm.reset({
      serviceType: service.serviceType,
      name: service.name,
      description: service.description,
      price: service.price,
      durationMinutes: service.durationMinutes,
      specialtyId: service.specialtyId ?? '',
      isBookable: service.isBookable ? 'true' : 'false',
      deliveryMode: service.deliveryMode,
    });
    setEditingServiceId(id);
    setIsServiceModalOpen(true);
  };

  const openCreateSpecialtyModal = () => {
    specialtyForm.reset({ name: '', description: '' });
    setEditingSpecialty(null);
    setIsSpecialtyModalOpen(true);
  };

  const openEditSpecialtyModal = (specialty: Specialty) => {
    specialtyForm.reset({ name: specialty.name, description: specialty.description });
    setEditingSpecialty(specialty);
    setIsSpecialtyModalOpen(true);
  };

  const handleServiceSubmit = serviceForm.handleSubmit(async (values) => {
    try {
      if (editingServiceId) {
        await updateServiceMutation.mutateAsync({ id: editingServiceId, values });
        setFeedbackModal({ open: true, title: 'Service updated', message: 'The service was updated successfully.', variant: 'success' });
      } else {
        await createServiceMutation.mutateAsync(values);
        setFeedbackModal({ open: true, title: 'Service created', message: 'The service was added successfully.', variant: 'success' });
      }
      setIsServiceModalOpen(false);
      setEditingServiceId(null);
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingServiceId ? 'Unable to update service' : 'Unable to create service',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the service.',
        variant: 'error',
      });
    }
  });

  const handleSpecialtySubmit = specialtyForm.handleSubmit(async (values) => {
    try {
      if (editingSpecialty) {
        await updateSpecialtyMutation.mutateAsync({ id: editingSpecialty.id, values });
        setFeedbackModal({ open: true, title: 'Specialty updated', message: 'The specialty was updated successfully.', variant: 'success' });
      } else {
        await createSpecialtyMutation.mutateAsync(values);
        setFeedbackModal({ open: true, title: 'Specialty created', message: 'The specialty was added successfully.', variant: 'success' });
      }
      setIsSpecialtyModalOpen(false);
      setEditingSpecialty(null);
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingSpecialty ? 'Unable to update specialty' : 'Unable to create specialty',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the specialty.',
        variant: 'error',
      });
    }
  });

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Delete this service from the catalog?')) return;
    try {
      await deleteServiceMutation.mutateAsync(id);
      setFeedbackModal({ open: true, title: 'Service deleted', message: 'The service was removed successfully.', variant: 'success' });
    } catch (error) {
      setFeedbackModal({ open: true, title: 'Unable to delete service', message: error instanceof Error ? error.message : 'Delete failed.', variant: 'error' });
    }
  };

  const handleDeleteSpecialty = async (id: string) => {
    if (!window.confirm('Delete this specialty?')) return;
    try {
      await deleteSpecialtyMutation.mutateAsync(id);
      setFeedbackModal({ open: true, title: 'Specialty deleted', message: 'The specialty was removed successfully.', variant: 'success' });
    } catch (error) {
      setFeedbackModal({ open: true, title: 'Unable to delete specialty', message: error instanceof Error ? error.message : 'Delete failed.', variant: 'error' });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <BriefcaseBusiness className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Service Catalog</h1>
                <p className="mt-1 text-sm text-slate-500">Manage services and specialties from searchable tables with modal forms.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" onClick={openCreateServiceModal}>
                <Plus className="mr-2 size-4" />
                Add service
              </Button>
              <Button className="rounded-none" onClick={openCreateSpecialtyModal} variant="secondary">
                <Plus className="mr-2 size-4" />
                Add specialty
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search service or specialty"
                  value={search}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-slate-950">Services</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Name</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Type</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Fee</th>
                    <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredServices.map((service) => (
                    <tr className="transition-colors hover:bg-slate-50" key={service.id}>
                      <td className="px-6 py-4 align-top">
                        <p className="font-bold text-slate-950">{service.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{service.description}</p>
                      </td>
                      <td className="px-6 py-4 align-top text-xs uppercase tracking-[0.14em] text-slate-500">
                        {formatServiceType(service.serviceType)}
                        <div className="mt-1 normal-case tracking-normal text-slate-400">
                          {formatDeliveryMode(service.deliveryMode)} · {service.durationMinutes} mins
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm font-bold text-slate-950">{formatCurrency(service.price)}</td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                          <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditServiceModal(service.id)} type="button">
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteService(service.id)} type="button">
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-slate-950">Specialties</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Name</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Description</th>
                    <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSpecialties.map((specialty) => (
                    <tr className="transition-colors hover:bg-slate-50" key={specialty.id}>
                      <td className="px-6 py-4 align-top font-bold text-slate-950">{specialty.name}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{specialty.description}</td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                          <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditSpecialtyModal(specialty)} type="button">
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteSpecialty(specialty.id)} type="button">
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isServiceModalOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6" onClick={() => setIsServiceModalOpen(false)} role="dialog">
          <div className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]" onClick={(event) => event.stopPropagation()}>
            <div className="bg-orange-600 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">Service Form</p>
                <p className="text-sm font-bold text-white mt-0.5">{editingServiceId ? 'Edit service' : 'Add service'}</p>
              </div>
              <button aria-label="Close service modal" className="inline-flex items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20" onClick={() => setIsServiceModalOpen(false)} type="button">
                <X className="size-4" />
              </button>
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleServiceSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <FormField error={serviceForm.formState.errors.serviceType?.message} label="Service Type">
                  <Select {...serviceForm.register('serviceType')}>
                    <option value="medical_service">Medical Service</option>
                    <option value="consultation">Consultation</option>
                    <option value="follow_up">Follow-up</option>
                  </Select>
                </FormField>
                <FormField error={serviceForm.formState.errors.name?.message} label="Name">
                  <Input {...serviceForm.register('name')} />
                </FormField>
                <FormField error={serviceForm.formState.errors.description?.message} label="Description">
                  <Textarea {...serviceForm.register('description')} />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField error={serviceForm.formState.errors.price?.message} label="Service Fee">
                    <Input type="number" {...serviceForm.register('price', { valueAsNumber: true })} />
                  </FormField>
                  <FormField error={serviceForm.formState.errors.durationMinutes?.message} label="Duration (minutes)">
                    <Input type="number" {...serviceForm.register('durationMinutes', { valueAsNumber: true })} />
                  </FormField>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Specialty">
                    <Select {...serviceForm.register('specialtyId')}>
                      <option value="">Unassigned</option>
                      {specialties.map((specialty) => (
                        <option key={specialty.id} value={specialty.id}>
                          {specialty.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Delivery mode">
                    <Select {...serviceForm.register('deliveryMode')}>
                      <option value="in_person">In person</option>
                      <option value="teleconsultation">Teleconsultation</option>
                      <option value="hybrid">Hybrid</option>
                    </Select>
                  </FormField>
                </div>
                <FormField label="Bookable in portal">
                  <Select {...serviceForm.register('isBookable')}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </Select>
                </FormField>
              </div>
              <div className="px-6 py-4 bg-slate-50 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={() => setIsServiceModalOpen(false)} type="button" variant="secondary">Cancel</Button>
                <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 sm:w-auto" disabled={createServiceMutation.isPending || updateServiceMutation.isPending} type="submit">
                  {createServiceMutation.isPending || updateServiceMutation.isPending ? 'Saving...' : editingServiceId ? 'Save Service' : 'Add Service'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isSpecialtyModalOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6" onClick={() => setIsSpecialtyModalOpen(false)} role="dialog">
          <div className="my-auto flex w-full max-w-xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="bg-orange-600 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">Specialty Form</p>
                <p className="text-sm font-bold text-white mt-0.5">{editingSpecialty ? 'Edit specialty' : 'Add specialty'}</p>
              </div>
              <button aria-label="Close specialty modal" className="inline-flex items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20" onClick={() => setIsSpecialtyModalOpen(false)} type="button">
                <X className="size-4" />
              </button>
            </div>
            <form className="px-6 py-5 space-y-4" onSubmit={handleSpecialtySubmit}>
              <FormField error={specialtyForm.formState.errors.name?.message} label="Specialty name">
                <Input {...specialtyForm.register('name')} />
              </FormField>
              <FormField error={specialtyForm.formState.errors.description?.message} label="Description">
                <Textarea {...specialtyForm.register('description')} />
              </FormField>
              <div className="pt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={() => setIsSpecialtyModalOpen(false)} type="button" variant="secondary">Cancel</Button>
                <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 sm:w-auto" disabled={createSpecialtyMutation.isPending || updateSpecialtyMutation.isPending} type="submit">
                  {createSpecialtyMutation.isPending || updateSpecialtyMutation.isPending ? 'Saving...' : editingSpecialty ? 'Save Specialty' : 'Add Specialty'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <FeedbackModal autoCloseMs={3000} message={feedbackModal.message} onClose={closeFeedbackModal} open={feedbackModal.open} title={feedbackModal.title} variant={feedbackModal.variant} />
    </>
  );
}
