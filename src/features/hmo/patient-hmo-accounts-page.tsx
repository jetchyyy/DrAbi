/**
 * Patient HMO Accounts — Link patients to their HMO memberships
 */
import { useState, useMemo, useDeferredValue } from "react";
import { ClipboardList, Plus, Pencil, Search, X, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { InternalPage } from "../../components/ui/internal-page";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
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
import { cn, formatCurrency } from "../../lib/utils";
import { StatusPill } from "../../components/ui/status-pill";
import { queryKeys } from "../../lib/query-keys";
import { listPatientsLiveOrDemo } from "../../lib/supabase-clinic";
import {
  usePatientHmoAccounts,
  useCreatePatientHmoAccount,
  useUpdatePatientHmoAccount,
  useHmoProviders,
} from "./api/hmo-hooks";
import type { PatientHmoAccount } from "../../types/domain";

export function PatientHmoAccountsPage() {
  const { data: accounts = [], isLoading } = usePatientHmoAccounts();
  const { data: providers = [] } = useHmoProviders();
  const { data: patients = [] } = useQuery({
    queryKey: queryKeys.patients,
    queryFn: listPatientsLiveOrDemo,
  });
  const createMutation = useCreatePatientHmoAccount();
  const updateMutation = useUpdatePatientHmoAccount();

  const providerMap = useMemo(() => new Map(providers.map((p) => [p.id, p.name])), [providers]);
  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, `${p.firstName} ${p.lastName}`])),
    [patients],
  );

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [formPatientId, setFormPatientId] = useState("");
  const [formProviderId, setFormProviderId] = useState("");
  const [formCardNumber, setFormCardNumber] = useState("");
  const [formMemberType, setFormMemberType] = useState("principal");
  const [formPrincipalName, setFormPrincipalName] = useState("");
  const [formExpiration, setFormExpiration] = useState("");
  const [formCoverageLimit, setFormCoverageLimit] = useState("0");
  const [formRemainingBalance, setFormRemainingBalance] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);

  const filtered = useMemo(
    () =>
      accounts.filter((a) => {
        const pName = patientMap.get(a.patientId) ?? "";
        const hName = providerMap.get(a.hmoProviderId) ?? "";
        return `${pName} ${hName} ${a.cardNumber}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase());
      }),
    [accounts, deferredSearch, patientMap, providerMap],
  );

  function resetForm() {
    setFormPatientId(patients[0]?.id ?? "");
    setFormProviderId(providers[0]?.id ?? "");
    setFormCardNumber("");
    setFormMemberType("principal");
    setFormPrincipalName("");
    setFormExpiration("");
    setFormCoverageLimit("0");
    setFormRemainingBalance("0");
    setFormIsActive(true);
  }

  function openCreate() {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(acct: PatientHmoAccount) {
    setFormPatientId(acct.patientId);
    setFormProviderId(acct.hmoProviderId);
    setFormCardNumber(acct.cardNumber);
    setFormMemberType(acct.memberType);
    setFormPrincipalName(acct.principalName);
    setFormExpiration(acct.expirationDate);
    setFormCoverageLimit(String(acct.coverageLimit));
    setFormRemainingBalance(String(acct.remainingBalance));
    setFormIsActive(acct.isActive);
    setEditingId(acct.id);
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!formPatientId || !formProviderId) {
      toast.error("Patient and HMO Provider are required");
      return;
    }
    const input = {
      patientId: formPatientId,
      hmoProviderId: formProviderId,
      cardNumber: formCardNumber.trim(),
      memberType: formMemberType,
      principalName: formPrincipalName.trim(),
      expirationDate: formExpiration,
      coverageLimit: Number(formCoverageLimit) || 0,
      remainingBalance: Number(formRemainingBalance) || 0,
      isActive: formIsActive,
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input });
        toast.success("Account updated");
      } else {
        await createMutation.mutateAsync(input);
        toast.success("Account created");
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save account");
    }
  }

  function isExpired(date: string) {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  return (
    <InternalPage>
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-teal-600 p-2.5 text-white">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">HMO Management</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Patient HMO Accounts</h1>
              <p className="mt-1 text-sm text-slate-500">Manage patient HMO memberships and coverage.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={openCreate}>
              <Plus className="mr-2 size-4" /> Link HMO Account
            </Button>
            <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient, HMO, card…"
                value={search}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50/90 px-6 py-2.5">
          <span className="text-xs font-bold text-slate-500">{filtered.length} account{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </section>

      <section className={INTERNAL_SURFACE}>
        <div className={INTERNAL_TABLE_SCROLL}>
          <table className={INTERNAL_TABLE}>
            <thead>
              <tr className={INTERNAL_THEAD_ROW}>
                <th className={INTERNAL_TH}>Patient</th>
                <th className={INTERNAL_TH}>HMO Provider</th>
                <th className={INTERNAL_TH}>Card #</th>
                <th className={INTERNAL_TH}>Type</th>
                <th className={INTERNAL_TH}>Expiration</th>
                <th className={INTERNAL_TH}>Coverage</th>
                <th className={INTERNAL_TH}>Balance</th>
                <th className={INTERNAL_TH}>Status</th>
                <th className={INTERNAL_TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-400">No accounts found</td></tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className={INTERNAL_TR}>
                    <td className={INTERNAL_TD}><span className="font-semibold text-slate-900">{patientMap.get(a.patientId) ?? "—"}</span></td>
                    <td className={INTERNAL_TD}>{providerMap.get(a.hmoProviderId) ?? "—"}</td>
                    <td className={INTERNAL_TD}>{a.cardNumber || "—"}</td>
                    <td className={INTERNAL_TD}><span className="capitalize">{a.memberType}</span></td>
                    <td className={INTERNAL_TD}>
                      {a.expirationDate ? (
                        <span className={cn("inline-flex items-center gap-1", isExpired(a.expirationDate) && "text-rose-600")}>
                          {isExpired(a.expirationDate) && <AlertTriangle className="size-3" />}
                          {new Date(a.expirationDate).toLocaleDateString("en-PH")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className={INTERNAL_TD}>{formatCurrency(a.coverageLimit)}</td>
                    <td className={INTERNAL_TD}>{formatCurrency(a.remainingBalance)}</td>
                    <td className={INTERNAL_TD}>
                      <StatusPill status={a.isActive ? "active" : "inactive"} />
                    </td>
                    <td className={INTERNAL_TD}>
                      <button className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" onClick={() => openEdit(a)} type="button">
                        <Pencil className="size-4" />
                      </button>
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
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
              <h2 className="text-lg font-bold">{editingId ? "Edit HMO Account" : "Link HMO Account"}</h2>
              <button className="rounded-lg p-1 transition hover:bg-slate-700" onClick={() => setModalOpen(false)} type="button"><X className="size-5" /></button>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
              <FormField label="Patient *">
                <Select value={formPatientId} onChange={(e) => setFormPatientId(e.target.value)}>
                  <option value="">Select patient</option>
                  {patients.map((p) => (<option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>))}
                </Select>
              </FormField>
              <FormField label="HMO Provider *">
                <Select value={formProviderId} onChange={(e) => setFormProviderId(e.target.value)}>
                  <option value="">Select provider</option>
                  {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </Select>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Card Number"><Input value={formCardNumber} onChange={(e) => setFormCardNumber(e.target.value)} /></FormField>
                <FormField label="Member Type">
                  <Select value={formMemberType} onChange={(e) => setFormMemberType(e.target.value)}>
                    <option value="principal">Principal</option>
                    <option value="dependent">Dependent</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Principal Name"><Input value={formPrincipalName} onChange={(e) => setFormPrincipalName(e.target.value)} placeholder="If dependent, name of principal member" /></FormField>
              <FormField label="Expiration Date"><Input type="date" value={formExpiration} onChange={(e) => setFormExpiration(e.target.value)} /></FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Coverage Limit (₱)"><Input type="number" value={formCoverageLimit} onChange={(e) => setFormCoverageLimit(e.target.value)} min={0} /></FormField>
                <FormField label="Remaining Balance (₱)"><Input type="number" value={formRemainingBalance} onChange={(e) => setFormRemainingBalance(e.target.value)} min={0} /></FormField>
              </div>
              <FormField label="Active">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} className="rounded" />
                  Account is currently active
                </label>
              </FormField>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="tertiary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleSubmit()} disabled={createMutation.isPending || updateMutation.isPending}>{editingId ? "Update" : "Create"}</Button>
            </div>
          </div>
        </div>
      )}
    </InternalPage>
  );
}
