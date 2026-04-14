import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, PackageSearch, Pencil, Plus, QrCode, ScanLine, Search, Trash2, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { getDatabase } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import { InventoryItemQrCard } from './components/inventory-item-qr-card';
import { extractInventoryItemQrCode } from './inventory-qr';
import { createInventoryItem, deleteInventoryItem, getCategories, getInventoryItems, getSupplier, updateInventoryItems } from '../../lib/supabase-clinic';
import type { InventoryItem } from '../../types/domain';

const inventorySchema = z.object({
  categoryId: z.string().min(1, 'Category is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  name: z.string().min(2, 'Item name must be at least 2 characters.'),
  sku: z.string().min(2, 'SKU must be at least 2 characters.'),
  unit: z.string().min(1, 'Unit is required.'),
  stockOnHand: z.number().min(0, 'Stock on hand cannot be negative.'),
  reorderLevel: z.number().min(0, 'Reorder level cannot be negative.'),
});

export type InventoryFormValues = z.infer<typeof inventorySchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}


export function InventoryPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const database = getDatabase();
  const [search, setSearch] = useState('');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);


  const page = 1;
  
  const { data: items = [] } = useQuery<InventoryItem[]>({
  queryKey: [queryKeys.inventory, page],
  queryFn: () => getInventoryItems(page),
});

    type Category = {
    id: string;
    name: string;
  };

  type Supplier = {
    id:string;
    name: string;
  }

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: getSupplier,
  });

  

  const createItemMutation = useMutation({
    mutationFn: async (values: InventoryFormValues) => createInventoryItem(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKeys.inventory] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, values }: { itemId: string; values: InventoryFormValues }) => {
      return updateInventoryItems(itemId, values)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKeys.inventory] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => deleteInventoryItem(itemId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKeys.inventory] });
    },
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
  const scannedCode = useMemo(() => extractInventoryItemQrCode(searchParams.get('qr') ?? ''), [searchParams]);
  const scannedItem = items.find((item) => item.qrCode === scannedCode) ?? null;
  const qrPreviewItems = scannedItem ? [scannedItem] : items.slice(0, 2);

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        `${item.name} ${item.sku} ${item.unit} ${item.qrCode}`.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, items],
  );

  useEffect(() => {
    if (!isItemModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsItemModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isItemModalOpen]);

  const openCreateModal = () => {
    form.reset({
      categoryId: database.inventoryCategories[0]?.id ?? '',
      supplierId: database.suppliers[0]?.id ?? '',
      name: '',
      sku: '',
      unit: 'box',
      stockOnHand: 0,
      reorderLevel: 10,
    });
    setEditingItemId(null);
    setIsItemModalOpen(true);
  };

  const openEditModal = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    form.reset({
      categoryId: item.category_id,
      supplierId: item.supplier_id?? '',
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      stockOnHand: item.stockOnHand,
      reorderLevel: item.reorderLevel,
    });
    setEditingItemId(itemId);
    setIsItemModalOpen(true);
  };

  const closeItemModal = () => {
    setEditingItemId(null);
    setIsItemModalOpen(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingItemId) {
        await updateItemMutation.mutateAsync({ itemId: editingItemId, values });
        setFeedbackModal({
          open: true,
          title: 'Inventory item updated',
          message: 'The inventory item was updated successfully.',
          variant: 'success',
        });
      } else {
        await createItemMutation.mutateAsync(values);
        setFeedbackModal({
          open: true,
          title: 'Inventory item created',
          message: 'The new inventory item was added successfully.',
          variant: 'success',
        });
      }

      closeItemModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingItemId ? 'Unable to update inventory item' : 'Unable to create inventory item',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the inventory item.',
        variant: 'error',
      });
    }
  });

  const handleDeleteItem = async (itemId: string) => {
    const isConfirmed = window.confirm('Delete this inventory item?');
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteItemMutation.mutateAsync(itemId);
      setFeedbackModal({
        open: true,
        title: 'Inventory item deleted',
        message: 'The inventory item was removed successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to delete inventory item',
        message: error instanceof Error ? error.message : 'Something went wrong while deleting the inventory item.',
        variant: 'error',
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        {scannedItem ? (
          <div className="border border-emerald-200 bg-emerald-50 px-6 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Scanned item recognized</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">{scannedItem.name} is ready to use for patient dispensing.</p>
              </div>
              <span className="bg-emerald-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-700">{scannedItem.stockOnHand} on hand</span>
            </div>
          </div>
        ) : null}

        {lowStockItems.length > 0 ? (
          <div className="overflow-hidden border border-rose-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 bg-rose-600 px-6 py-3">
              <AlertTriangle className="size-4 text-rose-100" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-rose-100">
                Low-Stock Alerts - {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-rose-50">
              {lowStockItems.map((item) => (
                <div className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-rose-50" key={item.id}>
                  <div>
                    <p className="font-bold text-sm text-slate-950">{item.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.unit} - reorder at {item.reorderLevel}
                    </p>
                  </div>
                  <span className="whitespace-nowrap bg-rose-100 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-rose-700">{item.stockOnHand} left</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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

        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <PackageSearch className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Inventory Control</p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Inventory Items</h1>
                <p className="mt-1 text-sm text-slate-500">Track stock, QR-ready labels, and low-stock items from one table.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                New item
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, SKU, unit, or QR code"
                  value={search}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
            <span className="text-xs font-bold text-slate-500">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found</span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.38fr]">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Item</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Category / Supplier</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Stock</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">QR Code</th>
                    <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td className="px-6 py-12 text-center text-sm text-slate-400" colSpan={5}>
                        No inventory items yet.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isLow = item.stockOnHand <= item.reorderLevel;
                      const isScanned = item.id === scannedItem?.id;
                      const category = categories?.find((entry) => entry.id === item.category_id);
                      const supplier = suppliers?.find((entry) => entry.id === item.supplier_id);

                      return (
                        <tr className={isScanned ? 'bg-emerald-50 transition-colors' : 'transition-colors hover:bg-slate-50'} key={item.id}>
                          <td className="px-6 py-4 align-top">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className={`shrink-0 p-1.5 ${isLow ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {isLow ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-slate-950">{item.name}</p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {item.sku} - {item.unit}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top text-sm text-slate-600">
                            <p>{category?.name ?? 'Uncategorized'}</p>
                            <p className="mt-1 text-xs text-slate-400">{supplier?.name ?? 'No supplier'}</p>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`whitespace-nowrap px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider ${isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {item.stockOnHand} on hand
                              </span>
                              <span className="bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                                Reorder {item.reorderLevel}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <span className="inline-flex items-center gap-1 break-all bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
                              <QrCode className="size-3.5" />
                              {item.qrCode}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                              <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(item.id)} type="button">
                                <Pencil className="size-3.5" />
                                Edit
                              </button>
                              <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteItem(item.id)} type="button">
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

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              {qrPreviewItems.map((item) => (
                <InventoryItemQrCard itemName={item.name} key={item.id} qrCode={item.qrCode} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {isItemModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeItemModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-orange-600 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">Inventory Form</p>
                <p className="mt-0.5 text-sm font-bold text-white">{editingItemId ? 'Edit Inventory Item' : 'Add Inventory Item'}</p>
                <p className="mt-2 max-w-2xl text-sm text-orange-50">Create or update inventory records from this modal form.</p>
              </div>
              <button
                aria-label="Close inventory modal"
                className="inline-flex shrink-0 items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeItemModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Classification</p>
                  <FormField error={form.formState.errors.categoryId?.message} label="Category">
                    <Select {...form.register('categoryId')}>
                     {categories?.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField error={form.formState.errors.supplierId?.message} label="Supplier">
                    <Select {...form.register('supplierId')}>
                      {suppliers?.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Item Details</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField error={form.formState.errors.name?.message} label="Item name">
                      <Input {...form.register('name')} />
                    </FormField>
                    <FormField error={form.formState.errors.sku?.message} label="SKU">
                      <Input {...form.register('sku')} />
                    </FormField>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField error={form.formState.errors.unit?.message} label="Unit">
                      <Input {...form.register('unit')} />
                    </FormField>
                    <FormField error={form.formState.errors.stockOnHand?.message} label="Stock on hand">
                      <Input type="number" {...form.register('stockOnHand', { valueAsNumber: true })} />
                    </FormField>
                    <FormField error={form.formState.errors.reorderLevel?.message} label="Reorder level">
                      <Input type="number" {...form.register('reorderLevel', { valueAsNumber: true })} />
                    </FormField>
                  </div>
                  <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-950">
                    Every new item automatically gets its own QR code for scanning during patient use.
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeItemModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button
                  className="w-full rounded-none bg-orange-600 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700 sm:w-auto"
                  disabled={createItemMutation.isPending || updateItemMutation.isPending}
                  type="submit"
                >
                  {createItemMutation.isPending || updateItemMutation.isPending
                    ? 'Saving...'
                    : editingItemId
                      ? 'Save Item'
                      : 'Add Item'}
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
