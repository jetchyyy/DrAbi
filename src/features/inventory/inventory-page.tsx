import { zodResolver } from '@hookform/resolvers/zod';
import { TriangleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
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
    form.reset({
      ...values,
      name: '',
      sku: '',
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <div className="space-y-6">
        <Card>
          <CardTitle className="text-3xl">Inventory control</CardTitle>
          <p className="mt-3 text-sm text-slate-500">Track medicines, supplies, stock movement, and supplier relationships.</p>
        </Card>
        {lowStockItems.length > 0 ? (
          <Card className="border-amber-200 bg-amber-50">
            <div className="flex items-center gap-3">
              <TriangleAlert className="size-5 text-amber-600" />
              <CardTitle>Low-stock alerts</CardTitle>
            </div>
            <div className="mt-4 space-y-3">
              {lowStockItems.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white p-4">
                  <p className="font-medium text-slate-950">{item.name}</p>
                  <p className="text-sm text-slate-500">
                    {item.stockOnHand} {item.unit} on hand, reorder at {item.reorderLevel}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
        <Card>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="font-medium text-slate-950">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.sku} • {item.unit}</p>
                </div>
                <Badge intent={item.stockOnHand <= item.reorderLevel ? 'warning' : 'success'}>
                  {item.stockOnHand} on hand
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Add inventory item</CardTitle>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <FormField label="Category">
            <Select {...form.register('categoryId')}>
              {database.inventoryCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Supplier">
            <Select {...form.register('supplierId')}>
              {database.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Item name">
              <Input {...form.register('name')} />
            </FormField>
            <FormField label="SKU">
              <Input {...form.register('sku')} />
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Unit">
              <Input {...form.register('unit')} />
            </FormField>
            <FormField label="Stock on hand">
              <Input type="number" {...form.register('stockOnHand', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Reorder level">
              <Input type="number" {...form.register('reorderLevel', { valueAsNumber: true })} />
            </FormField>
          </div>
          <Button className="w-full" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? 'Saving...' : 'Add item'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

