import { useState } from "react";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { FormField } from "../../components/forms/form-field";
import {
  INTERNAL_TABLE,
  INTERNAL_TABLE_SCROLL,
  INTERNAL_THEAD_ROW,
  INTERNAL_TH,
  INTERNAL_TR,
  INTERNAL_TD,
} from "../../lib/internal-ui";
import { StatusPill } from "../../components/ui/status-pill";
import {
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
} from "./api/companies-hooks";
import type { Company } from "../../types/domain";

interface CompaniesDirectoryTabProps {
  companies: Company[];
  isCompaniesLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filtered: Company[];
}

export function CompaniesDirectoryTab({
  isCompaniesLoading,
  search,
  onSearchChange,
  filtered,
}: CompaniesDirectoryTabProps) {
  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();
  const deleteMutation = useDeleteCompany();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formCompanyName, setFormCompanyName] = useState("");
  const [formCompanyCode, setFormCompanyCode] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formBillingCycle, setFormBillingCycle] = useState("monthly");
  const [formPaymentTerms, setFormPaymentTerms] = useState("Net 30");
  const [formStatus, setFormStatus] = useState("active");

  function resetForm() {
    setFormCompanyName("");
    setFormCompanyCode("");
    setFormContactPerson("");
    setFormContactEmail("");
    setFormContactPhone("");
    setFormAddress("");
    setFormBillingCycle("monthly");
    setFormPaymentTerms("Net 30");
    setFormStatus("active");
  }

  function openCreate() {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(company: Company) {
    setFormCompanyName(company.companyName);
    setFormCompanyCode(company.companyCode);
    setFormContactPerson(company.contactPerson);
    setFormContactEmail(company.contactEmail);
    setFormContactPhone(company.contactPhone);
    setFormAddress(company.address);
    setFormBillingCycle(company.billingCycle);
    setFormPaymentTerms(company.paymentTerms);
    setFormStatus(company.isActive ? "active" : "inactive");
    setEditingId(company.id);
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!formCompanyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    const input = {
      companyName: formCompanyName.trim(),
      companyCode: formCompanyCode.trim(),
      contactPerson: formContactPerson.trim(),
      contactEmail: formContactEmail.trim(),
      contactPhone: formContactPhone.trim(),
      address: formAddress.trim(),
      billingCycle: formBillingCycle,
      paymentTerms: formPaymentTerms,
      isActive: formStatus === "active",
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input });
        toast.success("Company updated");
      } else {
        await createMutation.mutateAsync(input);
        toast.success("Company created");
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save company",
      );
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this company?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Company deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete company",
      );
    }
  }

  return (
    <>
      {/* Toolbar: search + add button rendered by parent via headerActions */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-white border-b border-slate-100">
        <Button variant="primary" onClick={openCreate}>
          <Plus className="mr-2 size-4" /> Add Company
        </Button>
        <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search companies…"
            value={search}
          />
        </div>
      </div>

      <div className={INTERNAL_TABLE_SCROLL}>
        <table className={INTERNAL_TABLE}>
          <thead>
            <tr className={INTERNAL_THEAD_ROW}>
              <th className={INTERNAL_TH}>Company</th>
              <th className={INTERNAL_TH}>Code</th>
              <th className={INTERNAL_TH}>Contact</th>
              <th className={INTERNAL_TH}>Billing Cycle</th>
              <th className={INTERNAL_TH}>Payment Terms</th>
              <th className={INTERNAL_TH}>Status</th>
              <th className={INTERNAL_TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isCompaniesLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                  Loading companies…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                  No companies found
                </td>
              </tr>
            ) : (
              filtered.map((company) => (
                <tr key={company.id} className={INTERNAL_TR}>
                  <td className={INTERNAL_TD}>
                    <span className="font-semibold text-slate-900">
                      {company.companyName}
                    </span>
                  </td>
                  <td className={INTERNAL_TD}>{company.companyCode || "—"}</td>
                  <td className={INTERNAL_TD}>
                    <div className="text-sm">{company.contactPerson || "—"}</div>
                    {company.contactEmail ? (
                      <div className="text-xs text-slate-500">{company.contactEmail}</div>
                    ) : null}
                    {company.contactPhone ? (
                      <div className="text-xs text-slate-500">{company.contactPhone}</div>
                    ) : null}
                  </td>
                  <td className={INTERNAL_TD}>{company.billingCycle || "—"}</td>
                  <td className={INTERNAL_TD}>{company.paymentTerms || "—"}</td>
                  <td className={INTERNAL_TD}>
                    <StatusPill status={company.isActive ? "active" : "inactive"} />
                  </td>
                  <td className={INTERNAL_TD}>
                    <div className="flex gap-1">
                      <button
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        onClick={() => openEdit(company)}
                        title="Edit"
                        type="button"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => void handleDelete(company.id)}
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

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
              <h2 className="text-lg font-bold">
                {editingId ? "Edit Company" : "Add Company"}
              </h2>
              <button
                className="rounded-lg p-1 transition hover:bg-slate-700"
                onClick={() => setModalOpen(false)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <FormField label="Company Name *">
                <Input
                  value={formCompanyName}
                  onChange={(e) => setFormCompanyName(e.target.value)}
                  placeholder="e.g. ABC Holdings"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Company Code">
                  <Input
                    value={formCompanyCode}
                    onChange={(e) => setFormCompanyCode(e.target.value)}
                    placeholder="e.g. ABC001"
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
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    type="tel"
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
                <FormField label="Billing Cycle">
                  <Select
                    value={formBillingCycle}
                    onChange={(e) => setFormBillingCycle(e.target.value)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi-annual">Semi-annual</option>
                    <option value="annual">Annual</option>
                  </Select>
                </FormField>
                <FormField label="Payment Terms">
                  <Select
                    value={formPaymentTerms}
                    onChange={(e) => setFormPaymentTerms(e.target.value)}
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Due on receipt">Due on receipt</option>
                  </Select>
                </FormField>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="tertiary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSubmit()}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
