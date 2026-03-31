import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, PackageSearch } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { createInventoryItem, getDatabase, listInventoryItems } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';

const inventorySchema = z.object({
  categoryId: z.string().min(1),
  supplierId: z.string().min(1),
  name: z.string().min(2),
  sku: z.string().min(2),
  unit: z.string().min(1),
  stockOnHand: z.number().min(0),
  reorderLevel: z.number().min(0),
});

type InventoryFormValues = z.infer<typeof inventorySchema>;

export function InventoryPage() {
  const database = getDatabase();
  const { data: items = [] } = useQuery({
    queryKey: queryKeys.inventory,
    queryFn: async () => listInventoryItems(),
  });
  const mutation = useMutation({
    mutationFn: async (values: InventoryFormValues) => createInventoryItem(values),
  });
  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      categoryId: database.inventoryCategories[0]?.id ?? '',
      supplierId: database.suppliers[0]?.id ?? '',
      name: '',
      sku: '',
      unit: 'box',
      stockOnHand: 0,
      reorderLevel: 10,
    },
  });

  const lowStockItems = items.filter((item) => item.stockOnHand <= item.reorderLevel);

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    form.reset({ ...values, name: '', sku: '' });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <div className="space-y-4">
        {/* Low-stock alert panel */}
        {lowStockItems.length > 0 && (
          <div className="bg-white border border-rose-200 shadow-sm overflow-hidden">
            <div className="bg-rose-600 px-6 py-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-rose-100" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-rose-100">Low-Stock Alerts — {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-rose-50">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-rose-50 transition-colors">
                  <div>
                    <p className="font-bold text-sm text-slate-950">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.unit} · reorder at {item.reorderLevel}</p>
                  </div>
                  <span className="bg-rose-100 text-rose-700 text-xs font-extrabold px-2.5 py-1 uppercase tracking-wider whitespace-nowrap">
                    {item.stockOnHand} left
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory list */}
        <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
            <div className="p-2 bg-orange-600 text-white shrink-0">
              <PackageSearch className="size-4" />
            </div>
            <div>
              <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Inventory Control</p>
              <p className="text-[11px] text-slate-400 font-medium">Track medicines, supplies, and stock movement</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-400">No inventory items yet.</div>
            ) : (
              items.map((item) => {
                const isLow = item.stockOnHand <= item.reorderLevel;
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 shrink-0 ${isLow ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {isLow ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-950">{item.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.sku} · {item.unit}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-extrabold px-2.5 py-1 uppercase tracking-wider whitespace-nowrap ${isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.stockOnHand} on hand
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add item form */}
      <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-orange-600 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">New Item</p>
          <p className="text-sm font-bold text-white mt-0.5">Add Inventory Item</p>
        </div>
        <form className="divide-y divide-slate-100" onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Classification</p>
            <FormField label="Category">
              <Select {...form.register('categoryId')}>
                {database.inventoryCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Supplier">
              <Select {...form.register('supplierId')}>
                {database.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Item Details</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Item name"><Input {...form.register('name')} /></FormField>
              <FormField label="SKU"><Input {...form.register('sku')} /></FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Unit"><Input {...form.register('unit')} /></FormField>
              <FormField label="Stock on hand"><Input type="number" {...form.register('stockOnHand', { valueAsNumber: true })} /></FormField>
              <FormField label="Reorder level"><Input type="number" {...form.register('reorderLevel', { valueAsNumber: true })} /></FormField>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50">
            <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 font-extrabold uppercase tracking-widest text-sm py-5" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Saving…' : 'Add Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
