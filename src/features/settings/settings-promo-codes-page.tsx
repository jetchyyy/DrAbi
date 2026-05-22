import { zodResolver } from "@hookform/resolvers/zod";
import { Ticket, Pencil, Plus, Search, Trash2, X, Calendar } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { FeedbackModal } from "../../components/ui/feedback-modal";
import { Input } from "../../components/ui/input";
import { getBookableServicesLiveOrDemo, getPromoCodes, createPromoCode, updatePromoCode, deletePromoCode } from "../../lib/supabase-clinic";
import { formatCurrency } from "../../lib/utils";

const promoCodeSchema = z.object({
  code: z.string()
    .min(3, "Promo code must be at least 3 characters.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Promo code can only contain letters, numbers, hyphens, and underscores."),
  description: z.string().default(""),
  maxUses: z.coerce.number().min(1, "Max uses must be at least 1."),
  discountType: z.enum(["percentage", "fixed", "free"]),
  discountValue: z.coerce.number().min(0, "Discount value must be 0 or greater."),
  applicableServiceId: z.string().nullable().optional(),
  active: z.boolean().default(true),
  expiresAt: z.string().nullable().optional(),
});

export type PromoCodeFormValues = z.infer<typeof promoCodeSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: "success" | "error";
}

export function SettingsPromoCodesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: "",
    message: "",
    variant: "success",
  });

  const { data: promoCodes = [] } = useQuery({
    queryKey: ["settings-promo-codes"],
    queryFn: getPromoCodes,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["bookable-services"],
    queryFn: getBookableServicesLiveOrDemo,
  });

  const deferredSearch = useDeferredValue(search);

  const filteredPromoCodes = useMemo(
    () =>
      promoCodes.filter((promo) =>
        `${promo.code} ${promo.description} ${promo.discountType}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase())
      ),
    [deferredSearch, promoCodes]
  );

  const createMutation = useMutation({
    mutationFn: async (values: PromoCodeFormValues) => createPromoCode(values as any),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings-promo-codes"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: PromoCodeFormValues }) =>
      updatePromoCode(id, values as any),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings-promo-codes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deletePromoCode(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings-promo-codes"] });
    },
  });

  const form = useForm<PromoCodeFormValues>({
    resolver: zodResolver(promoCodeSchema) as any,
    defaultValues: {
      code: "",
      description: "",
      maxUses: 10,
      discountType: "percentage",
      discountValue: 10,
      applicableServiceId: "",
      active: true,
      expiresAt: "",
    },
  });

  const discountType = form.watch("discountType");

  useEffect(() => {
    if (discountType === "free") {
      form.setValue("discountValue", 0);
    }
  }, [discountType, form]);

  useEffect(() => {
    if (!isModalOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const openCreateModal = () => {
    form.reset({
      code: "",
      description: "",
      maxUses: 10,
      discountType: "percentage",
      discountValue: 10,
      applicableServiceId: "",
      active: true,
      expiresAt: "",
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (id: string) => {
    const promo = promoCodes.find((item) => item.id === id);
    if (!promo) return;
    form.reset({
      code: promo.code,
      description: promo.description || "",
      maxUses: promo.maxUses,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      applicableServiceId: promo.applicableServiceId || "",
      active: promo.active,
      expiresAt: promo.expiresAt ? promo.expiresAt.substring(0, 10) : "",
    });
    setEditingId(id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingId(null);
    setIsModalOpen(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({ ...currentState, open: false }));
  };

  const onSubmit = form.handleSubmit(async (fieldValues) => {
    const values = fieldValues as PromoCodeFormValues;
    try {
      const payload = {
        ...values,
        applicableServiceId: values.applicableServiceId || null,
        expiresAt: values.expiresAt || null,
      } as any;
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, values: payload });
        setFeedbackModal({
          open: true,
          title: "Promo code updated",
          message: "The promo code was updated successfully.",
          variant: "success",
        });
      } else {
        await createMutation.mutateAsync(payload);
        setFeedbackModal({
          open: true,
          title: "Promo code created",
          message: "The promo code was added successfully.",
          variant: "success",
        });
      }
      closeModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingId ? "Unable to update promo code" : "Unable to create promo code",
        message: error instanceof Error ? error.message : "Something went wrong.",
        variant: "error",
      });
    }
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this promo code?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      setFeedbackModal({
        open: true,
        title: "Promo code deleted",
        message: "The promo code was removed successfully.",
        variant: "success",
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: "Unable to delete promo code",
        message: error instanceof Error ? error.message : "Delete failed.",
        variant: "error",
      });
    }
  };

  const getStatusBadge = (promo: typeof promoCodes[0]) => {
    const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
    const isLimitReached = promo.usedCount >= promo.maxUses;

    if (!promo.active) {
      return (
        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          Inactive
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          Expired
        </span>
      );
    }
    if (isLimitReached) {
      return (
        <span className="inline-flex items-center gap-1 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
          Limit Reached
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        Active
      </span>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <Ticket className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Promo Codes Management</h1>
                <p className="mt-1 text-sm text-slate-500">Create, monitor, and disable promo codes for clinic services.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                Create Promo Code
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search promo code..."
                  value={search}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Code</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Discount</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Applicability</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Usage Tracker</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Expiry</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Status</th>
                  <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPromoCodes.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-sm text-slate-500" colSpan={7}>
                      No promo codes found.
                    </td>
                  </tr>
                ) : (
                  filteredPromoCodes.map((promo) => {
                    const remaining = Math.max(0, promo.maxUses - promo.usedCount);
                    const usagePercent = Math.min(100, (promo.usedCount / promo.maxUses) * 100);
                    const targetService = services.find(s => s.id === promo.applicableServiceId);

                    return (
                      <tr className="transition-colors hover:bg-slate-50" key={promo.id}>
                        <td className="px-6 py-4 align-top">
                          <span className="font-mono text-sm font-extrabold tracking-wider text-slate-900 bg-slate-100 px-2 py-1 rounded">
                            {promo.code}
                          </span>
                          {promo.description && (
                            <p className="mt-2 text-xs text-slate-500 max-w-[200px] break-words">{promo.description}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top text-sm font-bold text-slate-900">
                          {promo.discountType === "free" && (
                            <span className="text-emerald-700 font-extrabold uppercase">Free</span>
                          )}
                          {promo.discountType === "percentage" && `${promo.discountValue}% Off`}
                          {promo.discountType === "fixed" && `${formatCurrency(promo.discountValue)} Off`}
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-slate-600">
                          {targetService ? (
                            <span className="text-xs bg-orange-50 border border-orange-200 px-2 py-0.5 text-orange-800 rounded font-medium">
                              {targetService.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">All bookable services</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="w-[150px]">
                            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                              <span>{promo.usedCount} / {promo.maxUses} used</span>
                              <span className="text-slate-400">{remaining} left</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  usagePercent >= 100
                                    ? "bg-rose-500"
                                    : usagePercent >= 75
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-slate-600">
                          {promo.expiresAt ? (
                            <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                              <Calendar className="size-3.5 text-slate-400" />
                              {new Date(promo.expiresAt).toLocaleDateString("en-PH", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No expiry</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          {getStatusBadge(promo)}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                            <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(promo.id)} type="button">
                              <Pencil className="size-3.5" />
                              Edit
                            </button>
                            <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDelete(promo.id)} type="button">
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
      </div>

      {isModalOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6" onClick={closeModal} role="dialog">
          <div className="my-auto flex w-full max-w-xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="bg-orange-600 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">Promo Code Form</p>
                <p className="text-sm font-bold text-white mt-0.5">{editingId ? "Edit promo code" : "Create promo code"}</p>
              </div>
              <button aria-label="Close modal" className="inline-flex items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20" onClick={closeModal} type="button">
                <X className="size-4" />
              </button>
            </div>
            <form className="px-6 py-5 space-y-4" onSubmit={onSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField error={form.formState.errors.code?.message} label="Promo code (e.g. TELE10)">
                  <Input
                    {...form.register("code")}
                    onChange={(event) => {
                      form.setValue("code", event.target.value.toUpperCase());
                    }}
                    placeholder="ENTER CODE"
                  />
                </FormField>
                <FormField error={form.formState.errors.maxUses?.message} label="Maximum Uses">
                  <Input type="number" {...form.register("maxUses")} min={1} />
                </FormField>
              </div>

              <FormField error={form.formState.errors.description?.message} label="Description / Notes">
                <Input {...form.register("description")} placeholder="Describe what this coupon offers" />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField error={form.formState.errors.discountType?.message} label="Discount Type">
                  <select
                    className="w-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
                    {...form.register("discountType")}
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="fixed">Fixed Discount (₱)</option>
                    <option value="free">100% Free</option>
                  </select>
                </FormField>

                {discountType !== "free" && (
                  <FormField error={form.formState.errors.discountValue?.message} label="Discount Value">
                    <Input
                      type="number"
                      {...form.register("discountValue")}
                      min={0}
                      step="any"
                    />
                  </FormField>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField error={form.formState.errors.applicableServiceId?.message} label="Applicable Service">
                  <select
                    className="w-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
                    {...form.register("applicableServiceId")}
                  >
                    <option value="">All Services</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField error={form.formState.errors.expiresAt?.message} label="Expiry Date (Optional)">
                  <Input type="date" {...form.register("expiresAt")} />
                </FormField>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="active-checkbox"
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  {...form.register("active")}
                />
                <label htmlFor="active-checkbox" className="text-sm font-semibold text-slate-800">
                  Active (allows bookings to apply this code)
                </label>
              </div>

              <div className="pt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeModal} type="button" variant="secondary">Cancel</Button>
                <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 sm:w-auto" disabled={createMutation.isPending || updateMutation.isPending} type="submit">
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Save Promo Code" : "Create Promo Code"}
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
