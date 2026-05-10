import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PackageSearch,
  Pencil,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { FeedbackModal } from "../../components/ui/feedback-modal";
import { InternalPage } from "../../components/ui/internal-page";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import {
  INTERNAL_BTN_PAGE,
  INTERNAL_BTN_PAGE_ACTIVE,
  INTERNAL_SEARCH_INPUT_WRAP,
  INTERNAL_SURFACE,
  INTERNAL_SURFACE_FOOTER,
  INTERNAL_TABLE,
  INTERNAL_TABLE_SCROLL,
  INTERNAL_TD,
  INTERNAL_TH,
  INTERNAL_TR,
  INTERNAL_THEAD_ROW,
} from "../../lib/internal-ui";
import { getDatabase } from "../../lib/local-db";
import { queryKeys } from "../../lib/query-keys";
import { cn } from "../../lib/utils";
import QRCode from "qrcode";
import {
  buildInventoryItemQrValue,
  extractInventoryItemQrCode,
} from "./inventory-qr";
import {
  createInventoryItem,
  deleteInventoryItem,
  getCategories,
  getInventoryItems,
  getInventoryItemsCount,
  getSupplier,
  updateInventoryItems,
} from "../../lib/supabase-clinic";
import type { InventoryItem } from "../../types/domain";

const inventorySchema = z.object({
  categoryId: z.string().min(1, "Category is required."),
  supplierId: z.string().min(1, "Supplier is required."),
  brandName: z.string().max(120, "Brand name is too long."),
  name: z.string().min(2, "Item name must be at least 2 characters."),
  sku: z.string().min(2, "SKU must be at least 2 characters."),
  unit: z.string().min(1, "Unit is required."),
  stockOnHand: z.number().min(0, "Stock on hand cannot be negative."),
  reorderLevel: z.number().min(0, "Reorder level cannot be negative."),
  costPrice: z.number().min(0, "Cost price cannot be negative."),
  sellingPrice: z.number().min(0, "Selling price cannot be negative."),
});

export type InventoryFormValues = z.infer<typeof inventorySchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: "success" | "error";
}

interface InventoryItemQrInlineProps {
  itemName: string;
  qrCode: string;
}

function InventoryItemQrInline({ itemName, qrCode }: InventoryItemQrInlineProps) {
  const [svgMarkup, setSvgMarkup] = useState("");

  useEffect(() => {
    let active = true;

    void QRCode.toString(buildInventoryItemQrValue(qrCode), {
      errorCorrectionLevel: "M",
      margin: 1,
      type: "svg",
      width: 56,
    }).then((svg: string) => {
      if (active) {
        setSvgMarkup(svg);
      }
    });

    return () => {
      active = false;
    };
  }, [qrCode]);

  return (
    <div className="flex items-center justify-end gap-3">
      <div className="min-w-0 text-right">
        <p className="break-all font-mono text-xs font-semibold text-slate-800">
          {qrCode}
        </p>
      </div>
      <div className="grid size-[56px] shrink-0 place-items-center rounded-lg border border-slate-200/90 bg-white p-1 shadow-sm">
        {svgMarkup ? (
          <div
            aria-label={`QR code for ${itemName}`}
            className="size-[48px] [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <QrCode className="size-5 text-slate-400" />
        )}
      </div>
    </div>
  );
}

export function InventoryPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const database = getDatabase();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: "",
    message: "",
    variant: "success",
  });
  const deferredSearch = useDeferredValue(search);

  const ITEMS_PER_PAGE = 10;

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: [queryKeys.inventory, currentPage],
    queryFn: () => getInventoryItems(currentPage),
  });

  const { data: totalItemCount = 0 } = useQuery<number>({
    queryKey: [queryKeys.inventory, "count"],
    queryFn: getInventoryItemsCount,
  });

  type Category = {
    id: string;
    name: string;
  };

  type Supplier = {
    id: string;
    name: string;
  };

  const { data: categories } = useQuery<Category[]>({
    queryKey: queryKeys.inventoryCategories,
    queryFn: getCategories,
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: getSupplier,
  });

  const createItemMutation = useMutation({
    mutationFn: async (values: InventoryFormValues) =>
      createInventoryItem(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKeys.inventory] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      values,
    }: {
      itemId: string;
      values: InventoryFormValues;
    }) => {
      return updateInventoryItems(itemId, values);
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
      categoryId: database.inventoryCategories[0]?.id ?? "",
      supplierId: database.suppliers[0]?.id ?? "",
      brandName: "",
      name: "",
      sku: "",
      unit: "box",
      stockOnHand: 0,
      reorderLevel: 10,
      costPrice: 0,
      sellingPrice: 0,
    },
  });

  const lowStockItems = items.filter(
    (item) => item.stockOnHand <= item.reorderLevel,
  );
  const scannedCode = useMemo(
    () => extractInventoryItemQrCode(searchParams.get("qr") ?? ""),
    [searchParams],
  );
  const scannedItem = items.find((item) => item.qrCode === scannedCode) ?? null;

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        `${item.name} ${item.brandName ?? ""} ${item.sku} ${item.unit} ${item.qrCode}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, items],
  );

  const hasSearch = deferredSearch.trim().length > 0;
  const totalPages = hasSearch
    ? 1
    : Math.max(1, Math.ceil(totalItemCount / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!isItemModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsItemModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isItemModalOpen]);

  const openCreateModal = () => {
    form.reset({
      categoryId: database.inventoryCategories[0]?.id ?? "",
      supplierId: database.suppliers[0]?.id ?? "",
      brandName: "",
      name: "",
      sku: "",
      unit: "box",
      stockOnHand: 0,
      reorderLevel: 10,
      costPrice: 0,
      sellingPrice: 0,
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
      supplierId: item.supplier_id ?? "",
      brandName: item.brandName ?? "",
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      stockOnHand: item.stockOnHand,
      reorderLevel: item.reorderLevel,
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
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
          title: "Inventory item updated",
          message: "The inventory item was updated successfully.",
          variant: "success",
        });
      } else {
        await createItemMutation.mutateAsync(values);
        setFeedbackModal({
          open: true,
          title: "Inventory item created",
          message: "The new inventory item was added successfully.",
          variant: "success",
        });
      }

      closeItemModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingItemId
          ? "Unable to update inventory item"
          : "Unable to create inventory item",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while saving the inventory item.",
        variant: "error",
      });
    }
  });

  const handleDeleteItem = async (itemId: string) => {
    const isConfirmed = window.confirm("Delete this inventory item?");
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteItemMutation.mutateAsync(itemId);
      setFeedbackModal({
        open: true,
        title: "Inventory item deleted",
        message: "The inventory item was removed successfully.",
        variant: "success",
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: "Unable to delete inventory item",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while deleting the inventory item.",
        variant: "error",
      });
    }
  };

  return (
    <>
      <InternalPage>
        {scannedItem ? (
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--color-primary)_35%,white)] bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] px-6 py-4 shadow-[0_1px_2px_rgba(15,41,71,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-primary)]">
                  Scanned item recognized
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {scannedItem.name} is ready to use for patient dispensing.
                </p>
              </div>
              <span className="bg-[color-mix(in_srgb,var(--color-primary)_20%,white)] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[var(--color-primary)]">
                {scannedItem.stockOnHand} on hand
              </span>
            </div>
          </div>
        ) : null}

        {lowStockItems.length > 0 ? (
          <div className={INTERNAL_SURFACE}>
            <div className="flex flex-wrap items-center gap-2 border-b border-rose-100/90 bg-gradient-to-r from-rose-50 to-white px-6 py-3.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200/70">
                <AlertTriangle className="size-4" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-900">
                Low-stock alerts · {lowStockItems.length} item
                {lowStockItems.length !== 1 ? "s" : ""}
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {lowStockItems.map((item) => (
                <li key={item.id}>
                <div
                  className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-rose-50/40"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-950">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.unit} - reorder at {item.reorderLevel}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-800 ring-1 ring-rose-100">
                    {item.stockOnHand} left
                  </span>
                </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={cn(INTERNAL_SURFACE, "flex items-start gap-4 px-6 py-5")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-[var(--color-primary)] ring-1 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]">
            <ScanLine className="size-[18px]" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">QR scan workflow</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Open a patient chart, scan the medicine or supply QR, and the system deducts stock automatically.
            </p>
          </div>
        </div>

        <div className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] p-2.5 text-white shadow-sm">
                <PackageSearch className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Inventory control
                </p>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Inventory items
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Track stock, pricing, QR-ready labels, and low-stock items
                  from one table.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow-sm hover:brightness-95"
                onClick={openCreateModal}
              >
                <Plus className="mr-2 size-4" />
                New item
              </Button>
              <div className={`${INTERNAL_SEARCH_INPUT_WRAP} w-full max-w-sm py-2`}>
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
          <div className={cn(INTERNAL_SURFACE_FOOTER, "px-6 py-2.5")}>
            <span className="text-xs font-medium text-slate-600">
              {hasSearch
                ? `${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""} found on this page`
                : `${totalItemCount} item${totalItemCount !== 1 ? "s" : ""} total`}
            </span>
          </div>
        </div>

        <div className={INTERNAL_SURFACE}>
          <div className={INTERNAL_TABLE_SCROLL}>
            <table className={INTERNAL_TABLE}>
                <thead>
                  <tr className={INTERNAL_THEAD_ROW}>
                    <th className={INTERNAL_TH}>
                      Item
                    </th>
                    <th className={INTERNAL_TH}>
                      Category / Supplier
                    </th>
                    <th className={INTERNAL_TH}>
                      Stock
                    </th>
                    <th className={INTERNAL_TH}>
                      Pricing
                    </th>
                    <th className={cn(INTERNAL_TH, "text-right")}>
                      Item Code
                    </th>
                    <th className={cn(INTERNAL_TH, "text-right")}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr className={INTERNAL_TR}>
                      <td
                        className={cn(INTERNAL_TD, "py-12 text-center text-sm text-slate-500")}
                        colSpan={6}
                      >
                        No inventory items yet.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isLow = item.stockOnHand <= item.reorderLevel;
                      const isScanned = item.id === scannedItem?.id;
                      const category = categories?.find(
                        (entry) => entry.id === item.category_id,
                      );
                      const supplier = suppliers?.find(
                        (entry) => entry.id === item.supplier_id,
                      );

                      return (
                        <tr
                          className={cn(
                            INTERNAL_TR,
                            isScanned && "bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,white)]",
                          )}
                          key={item.id}
                        >
                          <td className={INTERNAL_TD}>
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={cn(
                                  "flex shrink-0 rounded-lg p-1.5 ring-1",
                                  isLow
                                    ? "bg-rose-50 text-rose-600 ring-rose-100"
                                    : "bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-[var(--color-primary)] ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]",
                                )}
                              >
                                {isLow ? (
                                  <AlertTriangle className="size-4" />
                                ) : (
                                  <CheckCircle2 className="size-4" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {item.name}
                                </p>
                                {item.brandName ? (
                                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                                    Brand: {item.brandName}
                                  </p>
                                ) : null}
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {item.sku} - {item.unit}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className={cn(INTERNAL_TD, "text-sm text-slate-600")}>
                            <p>{category?.name ?? "Uncategorized"}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {supplier?.name ?? "No supplier"}
                            </p>
                          </td>
                          <td className={INTERNAL_TD}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1",
                                  isLow
                                    ? "bg-rose-50 text-rose-800 ring-rose-100"
                                    : "bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-slate-900 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]",
                                )}
                              >
                                {item.stockOnHand} on hand
                              </span>
                              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
                                Reorder {item.reorderLevel}
                              </span>
                            </div>
                          </td>
                          <td className={cn(INTERNAL_TD, "text-sm text-slate-600")}>
                            <p>Cost: PHP {item.costPrice.toFixed(2)}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-800">
                              Sell: PHP {item.sellingPrice.toFixed(2)}
                            </p>
                          </td>
                          <td className={cn(INTERNAL_TD, "text-right")}>
                            <InventoryItemQrInline
                              itemName={item.name}
                              qrCode={item.qrCode}
                            />
                          </td>
                          <td className={cn(INTERNAL_TD, "text-right")}>
                            <div className="flex min-w-max items-center justify-end gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide">
                              <button
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                                onClick={() => openEditModal(item.id)}
                                type="button"
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </button>
                              <button
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-600 transition hover:bg-rose-50"
                                onClick={() => void handleDeleteItem(item.id)}
                                type="button"
                              >
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
          {!hasSearch ? (
            <div
              className={cn(
                INTERNAL_SURFACE_FOOTER,
                "flex flex-wrap items-center justify-between gap-3 px-6 py-3",
              )}
            >
              <span className="text-xs font-semibold text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  className={cn(INTERNAL_BTN_PAGE, "gap-1 px-3")}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  type="button"
                >
                  <ChevronLeft className="size-3.5" />
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    className={cn(
                      INTERNAL_BTN_PAGE,
                      p === currentPage && INTERNAL_BTN_PAGE_ACTIVE,
                    )}
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    type="button"
                  >
                    {p}
                  </button>
                ))}
                <button
                  className={cn(INTERNAL_BTN_PAGE, "gap-1 px-3")}
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  type="button"
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </InternalPage>

      {isItemModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeItemModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-[var(--color-primary)] px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
                  Inventory Form
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {editingItemId ? "Edit Inventory Item" : "Add Inventory Item"}
                </p>
                <p className="mt-2 max-w-2xl text-sm text-white/90">
                  Create or update inventory records from this modal form.
                </p>
              </div>
              <button
                aria-label="Close inventory modal"
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeItemModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    Classification
                  </p>
                  <FormField
                    error={form.formState.errors.categoryId?.message}
                    label="Category"
                  >
                    <Select {...form.register("categoryId")}>
                      {categories?.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField
                    error={form.formState.errors.supplierId?.message}
                    label="Supplier"
                  >
                    <Select {...form.register("supplierId")}>
                      {suppliers?.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    Item Details
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      error={form.formState.errors.name?.message}
                      label="Item name"
                    >
                      <Input {...form.register("name")} />
                    </FormField>
                    <FormField
                      error={form.formState.errors.brandName?.message}
                      label="Brand name"
                    >
                      <Input
                        placeholder="e.g. Unilab"
                        {...form.register("brandName")}
                      />
                    </FormField>
                    <FormField
                      error={form.formState.errors.sku?.message}
                      label="SKU"
                    >
                      <Input {...form.register("sku")} />
                    </FormField>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      error={form.formState.errors.unit?.message}
                      label="Unit"
                    >
                      <Input {...form.register("unit")} />
                    </FormField>
                    <FormField
                      error={form.formState.errors.stockOnHand?.message}
                      label="Stock on hand"
                    >
                      <Input
                        type="number"
                        {...form.register("stockOnHand", {
                          valueAsNumber: true,
                        })}
                      />
                    </FormField>
                    <FormField
                      error={form.formState.errors.reorderLevel?.message}
                      label="Reorder level"
                    >
                      <Input
                        type="number"
                        {...form.register("reorderLevel", {
                          valueAsNumber: true,
                        })}
                      />
                    </FormField>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      error={form.formState.errors.costPrice?.message}
                      label="Cost price"
                    >
                      <Input
                        min="0"
                        step="0.01"
                        type="number"
                        {...form.register("costPrice", { valueAsNumber: true })}
                      />
                    </FormField>
                    <FormField
                      error={form.formState.errors.sellingPrice?.message}
                      label="Selling price"
                    >
                      <Input
                        min="0"
                        step="0.01"
                        type="number"
                        {...form.register("sellingPrice", {
                          valueAsNumber: true,
                        })}
                      />
                    </FormField>
                  </div>
                  <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-950">
                    Every new item automatically gets its own QR code for
                    scanning during patient use.
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button
                  className="w-full sm:w-auto"
                  onClick={closeItemModal}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="w-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold uppercase tracking-wide shadow-sm hover:brightness-95 sm:w-auto"
                  disabled={
                    createItemMutation.isPending || updateItemMutation.isPending
                  }
                  type="submit"
                >
                  {createItemMutation.isPending || updateItemMutation.isPending
                    ? "Saving..."
                    : editingItemId
                      ? "Save Item"
                      : "Add Item"}
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
