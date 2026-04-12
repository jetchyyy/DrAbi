import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Search, TestTube2, Trash2, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FormField } from '../../../components/forms/form-field';
import { Button } from '../../../components/ui/button';
import { FeedbackModal } from '../../../components/ui/feedback-modal';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { createLabService, deleteLabService, getDatabase, updateLabService } from '../../../lib/local-db';
import { formatCurrency } from '../../../lib/utils';
import type { LabServiceCategory } from '../../../types/domain';

const catalogSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters.'),
  description: z.string().min(4, 'Description must be at least 4 characters.'),
  price: z.number().min(0, 'Price must be 0 or higher.'),
  category: z.enum(['laboratoryTests', 'imagingTests']),
});

type CatalogForm = z.infer<typeof catalogSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

const CATEGORY_LABELS: Record<LabServiceCategory, string> = {
  laboratoryTests: 'Laboratory Test',
  imagingTests: 'Imaging / Radiology',
};

export function CatalogTab() {
  const database = getDatabase();
  const qc = useQueryClient();
  const labServices = database.labServices;
  const [search, setSearch] = useState('');
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);

  const filteredServices = useMemo(
    () =>
      labServices.filter((service) =>
        `${service.name} ${service.description} ${service.category}`.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, labServices],
  );

  const form = useForm<CatalogForm>({
    resolver: zodResolver(catalogSchema),
    defaultValues: { name: '', description: '', price: 0, category: 'laboratoryTests' },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CatalogForm) =>
      createLabService({ name: values.name, description: values.description, price: values.price, category: values.category }),
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CatalogForm }) => updateLabService(id, values),
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteLabService(id),
    onSuccess: () => void qc.invalidateQueries(),
  });

  const openCreateModal = () => {
    form.reset({ name: '', description: '', price: 0, category: 'laboratoryTests' });
    setEditingId(null);
    setIsServiceModalOpen(true);
  };

  const openEditModal = (id: string) => {
    const service = labServices.find((entry) => entry.id === id);
    if (!service) {
      return;
    }

    form.reset({
      name: service.name,
      description: service.description,
      price: service.price,
      category: service.category,
    });
    setEditingId(id);
    setIsServiceModalOpen(true);
  };

  const closeServiceModal = () => {
    setEditingId(null);
    setIsServiceModalOpen(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, values });
        setFeedbackModal({
          open: true,
          title: 'Lab service updated',
          message: 'The laboratory service was updated successfully.',
          variant: 'success',
        });
      } else {
        await createMutation.mutateAsync(values);
        setFeedbackModal({
          open: true,
          title: 'Lab service created',
          message: 'The new laboratory service was added successfully.',
          variant: 'success',
        });
      }

      closeServiceModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingId ? 'Unable to update lab service' : 'Unable to create lab service',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the service.',
        variant: 'error',
      });
    }
  });

  const handleDeleteService = async (id: string) => {
    const isConfirmed = window.confirm('Delete this lab service from the catalog?');
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
      setFeedbackModal({
        open: true,
        title: 'Lab service deleted',
        message: 'The laboratory service was removed successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to delete lab service',
        message: error instanceof Error ? error.message : 'Something went wrong while deleting the service.',
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
              <div className="p-2.5 bg-violet-700 text-white shrink-0">
                <TestTube2 className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700">Lab Service Catalog</p>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-950">Catalog</h2>
                <p className="mt-1 text-sm text-slate-500">Manage lab and imaging services from a searchable service table.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-none bg-violet-700 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-violet-800" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                Add service
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search service, description, or category"
                  value={search}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
            <span className="text-xs font-bold text-slate-500">{filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''} found</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Service</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Description</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Category</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Fee</th>
                  <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-sm text-slate-400" colSpan={5}>
                      No lab services defined yet.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((service) => (
                    <tr className="transition-colors hover:bg-slate-50" key={service.id}>
                      <td className="px-6 py-4 align-top font-bold text-sm text-slate-950">{service.name}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{service.description}</td>
                      <td className="px-6 py-4 align-top text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        {CATEGORY_LABELS[service.category] ?? service.category}
                      </td>
                      <td className="px-6 py-4 align-top text-sm font-bold text-violet-700">{formatCurrency(service.price)}</td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                          <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(service.id)} type="button">
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isServiceModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeServiceModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-violet-700 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-violet-200">Service Form</p>
                <p className="text-sm font-bold text-white mt-0.5">{editingId ? 'Edit Service' : 'New lab or imaging service'}</p>
              </div>
              <button
                aria-label="Close service modal"
                className="inline-flex shrink-0 items-center justify-center border border-violet-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeServiceModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <FormField error={form.formState.errors.name?.message} label="Service name">
                  <Input {...form.register('name')} />
                </FormField>
                <FormField error={form.formState.errors.description?.message} label="Description">
                  <Textarea {...form.register('description')} />
                </FormField>
                <FormField error={form.formState.errors.price?.message} label="Service fee (PHP)">
                  <Input type="number" {...form.register('price', { valueAsNumber: true })} />
                </FormField>
                <FormField error={form.formState.errors.category?.message} label="Category">
                  <Select {...form.register('category')}>
                    <option value="laboratoryTests">Laboratory Test</option>
                    <option value="imagingTests">Imaging / Radiology</option>
                  </Select>
                </FormField>
              </div>
              <div className="px-6 py-4 bg-slate-50 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeServiceModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button className="w-full rounded-none bg-violet-700 hover:bg-violet-800 font-extrabold uppercase tracking-widest text-sm py-3 sm:w-auto" disabled={createMutation.isPending || updateMutation.isPending} type="submit">
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingId ? 'Save Service' : 'Add Service'}
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
