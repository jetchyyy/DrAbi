import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, PackageSearch, QrCode, ScanLine } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { createInventoryItem, getDatabase, listInventoryItems } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import { InventoryItemQrCard } from './components/inventory-item-qr-card';
import { extractInventoryItemQrCode } from './inventory-qr';

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
  const [searchParams] = useSearchParams();
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
  const scannedCode = useMemo(
    () => extractInventoryItemQrCode(searchParams.get('qr') ?? ''),
    [searchParams],
  );
  const scannedItem = items.find((item) => item.qrCode === scannedCode) ?? null;
  const qrPreviewItems = scannedItem ? [scannedItem] : items.slice(0, 2);

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    form.reset({ ...values, name: '', sku: '' });
  });

  return (
    <div className="space-y-6">
      {scannedItem ? (
        <div className="border border-emerald-200 bg-emerald-50 px-6 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Scanned item recognized</p>
              <p className="mt-1 text-sm font-semibold text-emerald-950">
                {scannedItem.name} is ready to use for patient dispensing.
              </p>
            </div>
            <span className="bg-emerald-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
              {scannedItem.stockOnHand} on hand
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="space-y-4">
          {lowStockItems.length > 0 && (
            <div className="overflow-hidden border border-rose-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 bg-rose-600 px-6 py-3">
                <AlertTriangle className="size-4 text-rose-100" />
                <p className="text-xs font-extrabold uppercase tracking-widest text-rose-100">
                  Low-Stock Alerts - {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="divide-y divide-rose-50">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-rose-50">
                    <div>
                      <p className="font-bold text-sm text-slate-950">{item.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.unit} - reorder at {item.reorderLevel}</p>
                    </div>
                    <span className="whitespace-nowrap bg-rose-100 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-rose-700">
                      {item.stockOnHand} left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-6 py-4">
              <div className="shrink-0 bg-orange-600 p-2 text-white">
                <PackageSearch className="size-4" />
              </div>
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Inventory Control</p>
                <p className="text-[11px] font-medium text-slate-400">Track medicines, supplies, stock, and QR-ready labels</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-400">No inventory items yet.</div>
              ) : (
                items.map((item) => {
                  const isLow = item.stockOnHand <= item.reorderLevel;
                  const isScanned = item.id === scannedItem?.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors ${
                        isScanned ? 'bg-emerald-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`shrink-0 p-1.5 ${isLow ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {isLow ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-950">{item.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{item.sku} - {item.unit}</p>
                          <p className="mt-1 break-all font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                            {item.qrCode}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`whitespace-nowrap px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider ${isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.stockOnHand} on hand
                        </span>
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                          <QrCode className="size-3.5" />
                          QR ready
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="bg-orange-600 px-6 py-4">
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">New Item</p>
              <p className="mt-0.5 text-sm font-bold text-white">Add Inventory Item</p>
            </div>
            <form className="divide-y divide-slate-100" onSubmit={onSubmit}>
              <div className="space-y-4 px-6 py-5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Classification</p>
                <FormField label="Category">
                  <Select {...form.register('categoryId')}>
                    {database.inventoryCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Supplier">
                  <Select {...form.register('supplierId')}>
                    {database.suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="space-y-4 px-6 py-5">
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
                <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-950">
                  Every new item automatically gets its own QR code for scanning during patient use.
                </div>
              </div>
              <div className="bg-slate-50 px-6 py-4">
                <Button className="w-full rounded-none bg-orange-600 py-5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" disabled={mutation.isPending} type="submit">
                  {mutation.isPending ? 'Saving...' : 'Add Item'}
                </Button>
              </div>
            </form>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {qrPreviewItems.map((item) => (
              <InventoryItemQrCard itemName={item.name} key={item.id} qrCode={item.qrCode} />
            ))}
          </div>

          <div className="border border-slate-200 bg-slate-950 px-6 py-5 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <ScanLine className="size-4 text-orange-300" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-200">Scan workflow</p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Use the item QR while treating a patient.</p>
            <p className="mt-2 text-sm text-slate-300">
              Open the patient chart, scan the medicine or supply QR into the inventory usage box, and the system will deduct stock automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
