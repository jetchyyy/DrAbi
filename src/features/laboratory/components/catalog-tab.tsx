import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, TestTube2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FormField } from '../../../components/forms/form-field';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { createLabService, deleteLabService, getDatabase, updateLabService } from '../../../lib/local-db';
import { formatCurrency } from '../../../lib/utils';
import type { LabServiceCategory } from '../../../types/domain';

const catalogSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(4),
  price: z.number().min(0),
  category: z.enum(['laboratoryTests', 'imagingTests']),
});
type CatalogForm = z.infer<typeof catalogSchema>;

const CATEGORY_LABELS: Record<LabServiceCategory, string> = {
  laboratoryTests: 'Laboratory Test',
  imagingTests: 'Imaging / Radiology',
};

export function CatalogTab() {
  const database = getDatabase();
  const qc = useQueryClient();
  const labServices = database.labServices;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; description: string; price: number; category: LabServiceCategory } | null>(null);

  const form = useForm<CatalogForm>({
    resolver: zodResolver(catalogSchema),
    defaultValues: { name: '', description: '', price: 0, category: 'laboratoryTests' },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CatalogForm) =>
      createLabService({ name: values.name, description: values.description, price: values.price, category: values.category }),
    onSuccess: () => {
      void qc.invalidateQueries();
      form.reset({ name: '', description: '', price: 0, category: 'laboratoryTests' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId || !editValues) return;
      updateLabService(editingId, editValues);
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      setEditingId(null);
      setEditValues(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteLabService(id),
    onSuccess: () => void qc.invalidateQueries(),
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
          <div className="p-2 bg-violet-700 text-white shrink-0">
            <TestTube2 className="size-4" />
          </div>
          <div>
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Lab Service Catalog</p>
            <p className="text-[11px] text-slate-400 font-medium">{labServices.length} service{labServices.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {labServices.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">No lab services defined yet.</div>
          ) : (
            labServices.map((svc) => (
              <div key={svc.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                {editingId === svc.id && editValues ? (
                  <div className="space-y-3">
                    <Input value={editValues.name} onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />
                    <Input value={editValues.description} onChange={(e) => setEditValues({ ...editValues, description: e.target.value })} />
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={editValues.price} onChange={(e) => setEditValues({ ...editValues, price: Number(e.target.value) })} />
                      <select
                        className="border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        value={editValues.category}
                        onChange={(e) => setEditValues({ ...editValues, category: e.target.value as LabServiceCategory })}
                      >
                        <option value="laboratoryTests">Laboratory Test</option>
                        <option value="imagingTests">Imaging / Radiology</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="text-xs py-2 px-4 bg-violet-700 hover:bg-violet-800 rounded-none font-extrabold uppercase tracking-widest"
                        disabled={updateMutation.isPending}
                        onClick={() => void updateMutation.mutate()}
                        type="button"
                      >
                        Save
                      </Button>
                      <button type="button" onClick={() => { setEditingId(null); setEditValues(null); }} className="text-xs font-bold uppercase tracking-widest px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-slate-950">{svc.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{svc.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-bold text-violet-700">{formatCurrency(svc.price)}</span>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{CATEGORY_LABELS[svc.category] ?? svc.category}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 border border-transparent hover:border-violet-200 transition-colors"
                        onClick={() => { setEditingId(svc.id); setEditValues({ name: svc.name, description: svc.description, price: svc.price, category: svc.category }); }}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                        onClick={() => void deleteMutation.mutate(svc.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-violet-700 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-violet-200">Add Service</p>
          <p className="text-sm font-bold text-white mt-0.5">New lab or imaging service</p>
        </div>
        <form className="divide-y divide-slate-100" onSubmit={form.handleSubmit(async (v) => void createMutation.mutate(v))}>
          <div className="px-6 py-5 space-y-4">
            <FormField label="Service name" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} />
            </FormField>
            <FormField label="Description" error={form.formState.errors.description?.message}>
              <Textarea {...form.register('description')} />
            </FormField>
            <FormField label="Service fee (₱)" error={form.formState.errors.price?.message}>
              <Input type="number" {...form.register('price', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Category">
              <Select {...form.register('category')}>
                <option value="laboratoryTests">Laboratory Test</option>
                <option value="imagingTests">Imaging / Radiology</option>
              </Select>
            </FormField>
          </div>
          <div className="px-6 py-4 bg-slate-50">
            <Button className="w-full rounded-none bg-violet-700 hover:bg-violet-800 font-extrabold uppercase tracking-widest text-sm py-5" disabled={createMutation.isPending} type="submit">
              {createMutation.isPending ? 'Saving…' : <span className="flex items-center gap-2 justify-center"><Plus className="size-4" /> Add Service</span>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
