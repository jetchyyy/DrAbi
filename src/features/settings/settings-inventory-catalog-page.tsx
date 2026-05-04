import { zodResolver } from "@hookform/resolvers/zod";
import { Package2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { FeedbackModal } from "../../components/ui/feedback-modal";
import { Input } from "../../components/ui/input";
import {
  createInventoryCategory,
  deleteInventoryCategory,
  getCategories,
  updateInventoryCategory,
} from "../../lib/supabase-clinic";
import { queryKeys } from "../../lib/query-keys";

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters."),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: "success" | "error";
}

export function SettingsInventoryCatalogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: "",
    message: "",
    variant: "success",
  });

  const deferredSearch = useDeferredValue(search);
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.inventoryCategories,
    queryFn: getCategories,
  });

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        category.name.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [categories, deferredSearch],
  );

  const createCategoryMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) =>
      createInventoryCategory(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryCategories,
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: CategoryFormValues;
    }) => updateInventoryCategory(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryCategories,
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => deleteInventoryCategory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryCategories,
      });
    },
  });

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (!isCategoryModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsCategoryModalOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCategoryModalOpen]);

  const openCreateModal = () => {
    form.reset({ name: "" });
    setEditingCategoryId(null);
    setIsCategoryModalOpen(true);
  };

  const openEditModal = (id: string) => {
    const category = categories.find((item) => item.id === id);
    if (!category) return;

    form.reset({ name: category.name });
    setEditingCategoryId(id);
    setIsCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setEditingCategoryId(null);
    setIsCategoryModalOpen(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({ ...currentState, open: false }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingCategoryId) {
        await updateCategoryMutation.mutateAsync({
          id: editingCategoryId,
          values,
        });
        setFeedbackModal({
          open: true,
          title: "Inventory category updated",
          message: "The category was updated successfully.",
          variant: "success",
        });
      } else {
        await createCategoryMutation.mutateAsync(values);
        setFeedbackModal({
          open: true,
          title: "Inventory category created",
          message: "The category was added successfully.",
          variant: "success",
        });
      }

      closeCategoryModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingCategoryId
          ? "Unable to update inventory category"
          : "Unable to create inventory category",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while saving the category.",
        variant: "error",
      });
    }
  });

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Delete this inventory category?")) return;

    try {
      await deleteCategoryMutation.mutateAsync(id);
      setFeedbackModal({
        open: true,
        title: "Inventory category deleted",
        message: "The category was removed successfully.",
        variant: "success",
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: "Unable to delete inventory category",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while deleting the category.",
        variant: "error",
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <Package2 className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                  Administration
                </p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
                  Inventory Catalog
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage the inventory categories that appear in the inventory
                  item form.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700"
                onClick={openCreateModal}
              >
                <Plus className="mr-2 size-4" />
                Add category
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search category"
                  value={search}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td
                        className="px-6 py-12 text-center text-sm text-slate-400"
                        colSpan={2}
                      >
                        No inventory categories yet.
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((category) => (
                      <tr
                        className="transition-colors hover:bg-slate-50"
                        key={category.id}
                      >
                        <td className="px-6 py-4 align-top font-semibold text-slate-950">
                          {category.name}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                            <button
                              className="inline-flex items-center gap-1 text-slate-600 hover:underline"
                              onClick={() => openEditModal(category.id)}
                              type="button"
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </button>
                            <button
                              className="inline-flex items-center gap-1 text-rose-600 hover:underline"
                              onClick={() =>
                                void handleDeleteCategory(category.id)
                              }
                              type="button"
                            >
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

          <div className="border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">
              How it is used
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Inventory categories here are the values shown in the item
              creation form under Inventory. Keep them short and familiar so
              staff can classify stock quickly.
            </p>
            <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-950">
              Categories with inventory items attached cannot be deleted.
            </div>
          </div>
        </div>
      </div>

      {isCategoryModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeCategoryModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-orange-600 px-6 py-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">
                  Inventory Category Form
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {editingCategoryId ? "Edit category" : "Add category"}
                </p>
                <p className="mt-2 max-w-2xl text-sm text-orange-50">
                  Create the category values that appear in inventory item
                  classification.
                </p>
              </div>
              <button
                aria-label="Close inventory category modal"
                className="inline-flex shrink-0 items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeCategoryModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex flex-1 flex-col" onSubmit={onSubmit}>
              <div className="space-y-4 px-6 py-5">
                <FormField
                  error={form.formState.errors.name?.message}
                  hint="This label will be available in the inventory item category dropdown."
                  label="Category name"
                >
                  <Input {...form.register("name")} />
                </FormField>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <Button
                  className="rounded-none border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-slate-700 hover:bg-slate-50"
                  onClick={closeCategoryModal}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-none bg-orange-600 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest hover:bg-orange-700"
                  type="submit"
                >
                  {editingCategoryId ? "Save changes" : "Add category"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {feedbackModal.open ? (
        <FeedbackModal
          message={feedbackModal.message}
          onClose={closeFeedbackModal}
          title={feedbackModal.title}
          variant={feedbackModal.variant}
        />
      ) : null}
    </>
  );
}
