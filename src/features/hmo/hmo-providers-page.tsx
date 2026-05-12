/**
 * HMO Providers — CRUD management page for HMO company directory
 */
import { useState, useMemo, useDeferredValue } from "react";
import { Building2, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { InternalPage } from "../../components/ui/internal-page";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { FormField } from "../../components/forms/form-field";
import {
  INTERNAL_SURFACE,
  INTERNAL_TABLE,
  INTERNAL_TABLE_SCROLL,
  INTERNAL_THEAD_ROW,
  INTERNAL_TH,
  INTERNAL_TR,
  INTERNAL_TD,
} from "../../lib/internal-ui";
import { cn } from "../../lib/utils";
import {
  useHmoProviders,
  useCreateHmoProvider,
  useUpdateHmoProvider,
  useDeleteHmoProvider,
} from "./api/hmo-hooks";
import type { HmoProvider } from "../../types/domain";

export function HmoProvidersPage() {
  const { data: providers = [], isLoading } = useHmoProviders();
  const createMutation = useCreateHmoProvider();
  const updateMutation = useUpdateHmoProvider();
  const deleteMutation = useDeleteHmoProvider();

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactNumber, setFormContactNumber] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formSubmissionCycle, setFormSubmissionCycle] = useState("monthly");
  const [formPaymentTerms, setFormPaymentTerms] = useState("30");
  const [formStatus, setFormStatus] = useState("active");

  const filtered = useMemo(
    () =>
      providers.filter(
        (p) =>
          `${p.name} ${p.code} ${p.contactPerson}`
            .toLowerCase()
            .includes(deferredSearch.toLowerCase()),
      ),
    [providers, deferredSearch],
  );

  function resetForm() {
    setFormName("");
    setFormCode("");
    setFormContactPerson("");
    setFormContactEmail("");
    setFormContactNumber("");
    setFormAddress("");
    setFormSubmissionCycle("monthly");
    setFormPaymentTerms("30");
    setFormStatus("active");
  }

  function openCreate() {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(provider: HmoProvider) {
    setFormName(provider.name);
    setFormCode(provider.code);
    setFormContactPerson(provider.contactPerson);
    setFormContactEmail(provider.contactEmail);
    setFormContactNumber(provider.contactNumber);
    setFormAddress(provider.address);
    setFormSubmissionCycle(provider.submissionCycle);
    setFormPaymentTerms(String(provider.paymentTermsDays));
    setFormStatus(provider.status);
    setEditingId(provider.id);
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!formName.trim()) {
      toast.error("Provider name is required");
      return;
    }
    const input = {
      name: formName.trim(),
      code: formCode.trim(),
      contactPerson: formContactPerson.trim(),
      contactEmail: formContactEmail.trim(),
      contactNumber: formContactNumber.trim(),
      address: formAddress.trim(),
      submissionCycle: formSubmissionCycle,
      paymentTermsDays: Number(formPaymentTerms) || 30,
      status: formStatus,
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input });
        toast.success("Provider updated");
      } else {
        await createMutation.mutateAsync(input);
        toast.success("Provider created");
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save provider",
      );
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this HMO provider?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Provider deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete provider",
      );
    }
  }

  return (
    <InternalPage>
      {/* Header */}
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-teal-600 p-2.5 text-white">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600">
                HMO Management
              </p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
                HMO Providers
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage HMO companies, contact details, and submission cycles.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold hover:bg-teal-700"
              onClick={openCreate}
            >
              <Plus className="mr-2 size-4" /> Add Provider
            </Button>
            <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search providers…"
                value={search}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50/90 px-6 py-2.5">
          <span className="text-xs font-bold text-slate-500">
            {filtered.length} provider{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </section>

      {/* Table */}
      <section className={INTERNAL_SURFACE}>
        <div className={INTERNAL_TABLE_SCROLL}>
          <table className={INTERNAL_TABLE}>
            <thead>
              <tr className={INTERNAL_THEAD_ROW}>
                <th className={INTERNAL_TH}>Name</th>
                <th className={INTERNAL_TH}>Code</th>
                <th className={INTERNAL_TH}>Contact</th>
                <th className={INTERNAL_TH}>Cycle</th>
                <th className={INTERNAL_TH}>Terms</th>
                <th className={INTERNAL_TH}>Status</th>
                <th className={INTERNAL_TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                    Loading providers…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                    No HMO providers found
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className={INTERNAL_TR}>
                    <td className={INTERNAL_TD}>
                      <span className="font-semibold text-slate-900">{p.name}</span>
                    </td>
                    <td className={INTERNAL_TD}>{p.code || "—"}</td>
                    <td className={INTERNAL_TD}>
                      <div className="text-sm">{p.contactPerson || "—"}</div>
                      <div className="text-xs text-slate-500">{p.contactEmail}</div>
                    </td>
                    <td className={INTERNAL_TD}>{p.submissionCycle}</td>
                    <td className={INTERNAL_TD}>{p.paymentTermsDays} days</td>
                    <td className={INTERNAL_TD}>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ring-1",
                          p.status === "active"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-slate-200",
                        )}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className={INTERNAL_TD}>
                      <div className="flex gap-1">
                        <button
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          onClick={() => openEdit(p)}
                          title="Edit"
                          type="button"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => void handleDelete(p.id)}
                          title="Delete"
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-teal-600 px-6 py-4 text-white">
              <h2 className="text-lg font-bold">
                {editingId ? "Edit Provider" : "Add HMO Provider"}
              </h2>
              <button
                className="rounded-lg p-1 transition hover:bg-teal-700"
                onClick={() => setModalOpen(false)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <FormField label="Provider Name *">
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Maxicare"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Code">
                  <Input
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. MAXI"
                  />
                </FormField>
                <FormField label="Status">
                  <Select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Contact Person">
                <Input
                  value={formContactPerson}
                  onChange={(e) => setFormContactPerson(e.target.value)}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email">
                  <Input
                    value={formContactEmail}
                    onChange={(e) => setFormContactEmail(e.target.value)}
                    type="email"
                  />
                </FormField>
                <FormField label="Phone">
                  <Input
                    value={formContactNumber}
                    onChange={(e) => setFormContactNumber(e.target.value)}
                  />
                </FormField>
              </div>
              <FormField label="Address">
                <Textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  rows={2}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Submission Cycle">
                  <Select
                    value={formSubmissionCycle}
                    onChange={(e) => setFormSubmissionCycle(e.target.value)}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </Select>
                </FormField>
                <FormField label="Payment Terms (days)">
                  <Input
                    value={formPaymentTerms}
                    onChange={(e) => setFormPaymentTerms(e.target.value)}
                    type="number"
                    min={1}
                  />
                </FormField>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button
                variant="secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => void handleSubmit()}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </InternalPage>
  );
}
