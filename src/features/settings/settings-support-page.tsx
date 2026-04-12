import { zodResolver } from '@hookform/resolvers/zod';
import { Boxes, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { createSupplier, deleteSupplierRecord, getDatabase, listSuppliers, updateSupplierRecord } from '../../lib/local-db';

const supplierSchema = z.object({
  name: z.string().min(2, 'Supplier name must be at least 2 characters.'),
  contactPerson: z.string().min(2, 'Contact person must be at least 2 characters.'),
  phone: z.string().min(5, 'Phone number must be at least 5 characters.'),
  email: z.email('Enter a valid email address.'),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

export function SettingsSupportPage() {
  const queryClient = useQueryClient();
  const database = getDatabase();
  const clinic = database.clinicSettings;
  const { data: suppliers = [] } = useQuery({ queryKey: ['settings-suppliers'], queryFn: async () => listSuppliers() });
  const [search, setSearch] = useState('');
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((supplier) =>
        `${supplier.name} ${supplier.contactPerson} ${supplier.phone} ${supplier.email}`.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, suppliers],
  );

  const createSupplierMutation = useMutation({
    mutationFn: async (values: SupplierFormValues) => createSupplier(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-suppliers'] });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SupplierFormValues }) => updateSupplierRecord(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-suppliers'] });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => deleteSupplierRecord(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-suppliers'] });
    },
  });

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
    },
  });

  useEffect(() => {
    if (!isSupplierModalOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSupplierModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSupplierModalOpen]);

  const openCreateModal = () => {
    form.reset({ name: '', contactPerson: '', phone: '', email: '' });
    setEditingSupplierId(null);
    setIsSupplierModalOpen(true);
  };

  const openEditModal = (id: string) => {
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) return;
    form.reset({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
    });
    setEditingSupplierId(id);
    setIsSupplierModalOpen(true);
  };

  const closeSupplierModal = () => {
    setEditingSupplierId(null);
    setIsSupplierModalOpen(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({ ...currentState, open: false }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingSupplierId) {
        await updateSupplierMutation.mutateAsync({ id: editingSupplierId, values });
        setFeedbackModal({ open: true, title: 'Supplier updated', message: 'The supplier was updated successfully.', variant: 'success' });
      } else {
        await createSupplierMutation.mutateAsync(values);
        setFeedbackModal({ open: true, title: 'Supplier created', message: 'The supplier was added successfully.', variant: 'success' });
      }
      closeSupplierModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingSupplierId ? 'Unable to update supplier' : 'Unable to create supplier',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the supplier.',
        variant: 'error',
      });
    }
  });

  const handleDeleteSupplier = async (id: string) => {
    if (!window.confirm('Delete this supplier?')) return;
    try {
      await deleteSupplierMutation.mutateAsync(id);
      setFeedbackModal({ open: true, title: 'Supplier deleted', message: 'The supplier was removed successfully.', variant: 'success' });
    } catch (error) {
      setFeedbackModal({ open: true, title: 'Unable to delete supplier', message: error instanceof Error ? error.message : 'Delete failed.', variant: 'error' });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <Boxes className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Supplier Management</h1>
                <p className="mt-1 text-sm text-slate-500">Manage suppliers in a table and keep clinic operating preferences visible alongside them.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                Add supplier
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search supplier, contact, phone, or email"
                  value={search}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Supplier</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Contact Person</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Contact Details</th>
                    <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.map((supplier) => (
                    <tr className="transition-colors hover:bg-slate-50" key={supplier.id}>
                      <td className="px-6 py-4 align-top font-bold text-slate-950">{supplier.name}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{supplier.contactPerson}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">
                        <p>{supplier.phone}</p>
                        <p className="mt-1 text-xs text-slate-400">{supplier.email}</p>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                          <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(supplier.id)} type="button">
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteSupplier(supplier.id)} type="button">
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

          <div className="border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Clinic Preferences</h2>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <p>{clinic.bookingLeadDays} days allowed for advance booking.</p>
              <p>{clinic.bookingCancellationHours} hours notice for cancellation.</p>
              <p>{clinic.appointmentSlotMinutes}-minute default appointment slots.</p>
              <p>Teleconsultation-ready services should use hybrid or teleconsultation delivery modes so your scheduling team can route them correctly.</p>
              <div className="space-y-2">
                {clinic.operatingHours.map((slot) => (
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3" key={slot.day}>
                    <span className="font-medium text-slate-950">{slot.day}</span>
                    <span>{slot.enabled ? `${slot.open} - ${slot.close}` : 'Closed'}</span>
                  </div>
                ))}
              </div>
              <Textarea readOnly value={`Clinic address: ${clinic.address}
Contact number: ${clinic.contactNumber}
Email: ${clinic.email}`} />
            </div>
          </div>
        </div>
      </div>

      {isSupplierModalOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6" onClick={closeSupplierModal} role="dialog">
          <div className="my-auto flex w-full max-w-xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="bg-orange-600 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">Supplier Form</p>
                <p className="text-sm font-bold text-white mt-0.5">{editingSupplierId ? 'Edit supplier' : 'Add supplier'}</p>
              </div>
              <button aria-label="Close supplier modal" className="inline-flex items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20" onClick={closeSupplierModal} type="button">
                <X className="size-4" />
              </button>
            </div>
            <form className="px-6 py-5 space-y-4" onSubmit={onSubmit}>
              <FormField error={form.formState.errors.name?.message} label="Supplier name">
                <Input {...form.register('name')} />
              </FormField>
              <FormField error={form.formState.errors.contactPerson?.message} label="Contact person">
                <Input {...form.register('contactPerson')} />
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField error={form.formState.errors.phone?.message} label="Phone">
                  <Input {...form.register('phone')} />
                </FormField>
                <FormField error={form.formState.errors.email?.message} label="Email">
                  <Input {...form.register('email')} />
                </FormField>
              </div>
              <div className="pt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeSupplierModal} type="button" variant="secondary">Cancel</Button>
                <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 sm:w-auto" disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending} type="submit">
                  {createSupplierMutation.isPending || updateSupplierMutation.isPending ? 'Saving...' : editingSupplierId ? 'Save Supplier' : 'Add Supplier'}
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
