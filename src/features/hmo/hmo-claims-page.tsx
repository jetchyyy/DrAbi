/**
 * HMO Claims — Full claim lifecycle management with billing computation
 */
import { useState, useMemo, useDeferredValue, useEffect } from "react";
import { Receipt, Plus, Search, X, Eye, Upload } from "lucide-react";
import { toast } from "sonner";

import { InternalPage } from "../../components/ui/internal-page";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { FormField } from "../../components/forms/form-field";
import { INTERNAL_SURFACE, INTERNAL_TABLE, INTERNAL_TABLE_SCROLL, INTERNAL_THEAD_ROW, INTERNAL_TH, INTERNAL_TR, INTERNAL_TD } from "../../lib/internal-ui";
import { cn, formatCurrency } from "../../lib/utils";
import { useHmoClaims, useCreateHmoClaim, useUpdateHmoClaim, useHmoAuthorizations, useHmoProviders } from "./api/hmo-hooks";
import { uploadHmoDocument } from "./api/hmo-service";
import { HmoStatusBadge } from "./components/hmo-status-badge";
import type { HmoClaimStatus } from "../../types/domain";

const CLAIM_STATUSES: { value: HmoClaimStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending_submission", label: "Pending Submission" },
  { value: "submitted", label: "Submitted" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "denied", label: "Denied" },
  { value: "partial_payment", label: "Partial Payment" },
  { value: "overdue", label: "Overdue" },
];

export function HmoClaimsPage() {
  const { data: claims = [], isLoading } = useHmoClaims();
  const { data: authorizations = [] } = useHmoAuthorizations();
  const { data: providers = [] } = useHmoProviders();
  const createMutation = useCreateHmoClaim();
  const updateMutation = useUpdateHmoClaim();

  const providerMap = useMemo(() => new Map(providers.map((p) => [p.id, p.name])), [providers]);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingClaim, setViewingClaim] = useState<string | null>(null);

  // Form
  const [formAuthId, setFormAuthId] = useState("");
  const [formInvoiceNo, setFormInvoiceNo] = useState("");
  const [formTotal, setFormTotal] = useState("0");
  const [formCovered, setFormCovered] = useState("0");
  const [formRemarks, setFormRemarks] = useState("");

  // Auto-computed patient excess
  const patientExcess = Math.max(0, (Number(formTotal) || 0) - (Number(formCovered) || 0));

  const filtered = useMemo(
    () =>
      claims.filter((c) => {
        const matchesSearch = `${c.invoiceNumber} ${c.remarks}`.toLowerCase().includes(deferredSearch.toLowerCase());
        const matchesStatus = statusFilter === "all" || c.claimStatus === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [claims, deferredSearch, statusFilter],
  );

  // Generate invoice number
  function generateInvoiceNumber() {
    const date = new Date();
    const prefix = "HMO";
    const ts = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const seq = String(claims.length + 1).padStart(4, "0");
    return `${prefix}-${ts}-${seq}`;
  }

  function openCreate() {
    setFormAuthId(authorizations.filter((a) => a.approvalStatus === "approved")[0]?.id ?? "");
    setFormInvoiceNo(generateInvoiceNumber());
    setFormTotal("0");
    setFormCovered("0");
    setFormRemarks("");
    setModalOpen(true);
  }

  // Pre-fill coverage when authorization changes
  useEffect(() => {
    if (!formAuthId) return;
    const auth = authorizations.find((a) => a.id === formAuthId);
    if (auth) setFormCovered(String(auth.coverageAmount));
  }, [formAuthId, authorizations]);

  async function handleCreate() {
    try {
      await createMutation.mutateAsync({
        authorizationId: formAuthId || null,
        invoiceNumber: formInvoiceNo.trim(),
        totalAmount: Number(formTotal) || 0,
        coveredAmount: Number(formCovered) || 0,
        patientExcess,
        claimStatus: "draft",
        submissionDate: null,
        paymentDueDate: null,
        paidDate: null,
        remarks: formRemarks.trim(),
      });
      toast.success("Claim created");
      setModalOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleStatusChange(id: string, newStatus: HmoClaimStatus) {
    try {
      const updates: Record<string, unknown> = { claimStatus: newStatus };
      if (newStatus === "submitted") updates.submissionDate = new Date().toISOString();
      if (newStatus === "paid") updates.paidDate = new Date().toISOString();
      await updateMutation.mutateAsync({ id, input: updates as any });
      toast.success(`Claim status updated to ${newStatus.replace(/_/g, " ")}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleFileUpload(claimId: string, file: File) {
    try {
      const path = `claims/${claimId}/${Date.now()}-${file.name}`;
      await uploadHmoDocument("hmo-claims", path, file);
      toast.success("Document uploaded");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
  }

  const viewedClaim = claims.find((c) => c.id === viewingClaim);
  const viewedAuth = viewedClaim ? authorizations.find((a) => a.id === viewedClaim.authorizationId) : null;

  return (
    <InternalPage>
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-teal-600 p-2.5 text-white"><Receipt className="size-5" /></div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600">HMO Management</p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Claims</h1>
              <p className="mt-1 text-sm text-slate-500">Track HMO claims from draft to payment.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="rounded-xl bg-teal-600 hover:bg-teal-700" onClick={openCreate}><Plus className="mr-2 size-4" /> New Claim</Button>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl">
              <option value="all">All Statuses</option>
              {CLAIM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice…" value={search} />
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50/90 px-6 py-2.5">
          <span className="text-xs font-bold text-slate-500">{filtered.length} claim{filtered.length !== 1 ? "s" : ""}</span>
          {["draft", "submitted", "processing", "paid", "overdue"].map((s) => {
            const count = claims.filter((c) => c.claimStatus === s).length;
            if (count === 0) return null;
            return (
              <span key={s} className="ml-1"><HmoStatusBadge status={s} type="claim" className="text-[10px]" /></span>
            );
          })}
        </div>
      </section>

      <section className={INTERNAL_SURFACE}>
        <div className={INTERNAL_TABLE_SCROLL}>
          <table className={INTERNAL_TABLE}>
            <thead><tr className={INTERNAL_THEAD_ROW}>
              <th className={INTERNAL_TH}>Invoice #</th>
              <th className={INTERNAL_TH}>Total Bill</th>
              <th className={INTERNAL_TH}>HMO Coverage</th>
              <th className={INTERNAL_TH}>Patient Excess</th>
              <th className={INTERNAL_TH}>Status</th>
              <th className={INTERNAL_TH}>Submitted</th>
              <th className={INTERNAL_TH}>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">No claims found</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className={INTERNAL_TR}>
                  <td className={INTERNAL_TD}><span className="font-semibold text-slate-900">{c.invoiceNumber || "—"}</span></td>
                  <td className={INTERNAL_TD}>{formatCurrency(c.totalAmount)}</td>
                  <td className={INTERNAL_TD}><span className="font-medium text-emerald-700">{formatCurrency(c.coveredAmount)}</span></td>
                  <td className={INTERNAL_TD}><span className="font-medium text-amber-700">{formatCurrency(c.patientExcess)}</span></td>
                  <td className={INTERNAL_TD}><HmoStatusBadge status={c.claimStatus} type="claim" /></td>
                  <td className={INTERNAL_TD}>{c.submissionDate ? new Date(c.submissionDate).toLocaleDateString("en-PH") : "—"}</td>
                  <td className={INTERNAL_TD}>
                    <div className="flex gap-1">
                      <button className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100" onClick={() => setViewingClaim(c.id)} title="View" type="button"><Eye className="size-4" /></button>
                      <Select className="h-8 rounded-lg border-slate-200 text-xs" value={c.claimStatus} onChange={(e) => void handleStatusChange(c.id, e.target.value as HmoClaimStatus)}>
                        {CLAIM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </Select>
                      <label className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100" title="Upload">
                        <Upload className="size-4" />
                        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileUpload(c.id, f); }} />
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-teal-600 px-6 py-4 text-white">
              <h2 className="text-lg font-bold">New Claim</h2>
              <button className="rounded-lg p-1 transition hover:bg-teal-700" onClick={() => setModalOpen(false)} type="button"><X className="size-5" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <FormField label="Authorization">
                <Select value={formAuthId} onChange={(e) => setFormAuthId(e.target.value)}>
                  <option value="">No authorization</option>
                  {authorizations.filter((a) => a.approvalStatus === "approved").map((a) => (
                    <option key={a.id} value={a.id}>{a.authorizationCode || a.id.slice(0, 8)} — {formatCurrency(a.coverageAmount)}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Invoice Number"><Input value={formInvoiceNo} onChange={(e) => setFormInvoiceNo(e.target.value)} /></FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Total Bill (₱)"><Input type="number" value={formTotal} onChange={(e) => setFormTotal(e.target.value)} min={0} /></FormField>
                <FormField label="HMO Coverage (₱)"><Input type="number" value={formCovered} onChange={(e) => setFormCovered(e.target.value)} min={0} /></FormField>
              </div>
              {/* Auto-computed patient excess */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Patient Excess (Auto-Computed)</p>
                <p className="mt-1 text-xl font-bold text-amber-800">{formatCurrency(patientExcess)}</p>
                <p className="mt-1 text-xs text-amber-600">Total Bill − HMO Coverage = Patient Pays</p>
              </div>
              <FormField label="Remarks"><Textarea value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} rows={2} /></FormField>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => void handleCreate()} disabled={createMutation.isPending}>Create Claim</Button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewingClaim && viewedClaim && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-800 px-6 py-4 text-white">
              <h2 className="text-lg font-bold">Claim Details</h2>
              <button className="rounded-lg p-1 transition hover:bg-slate-700" onClick={() => setViewingClaim(null)} type="button"><X className="size-5" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-semibold text-slate-500">Invoice #</p><p className="text-sm font-bold text-slate-900">{viewedClaim.invoiceNumber || "—"}</p></div>
                <div><p className="text-xs font-semibold text-slate-500">Status</p><HmoStatusBadge status={viewedClaim.claimStatus} type="claim" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold text-slate-500">Total</p><p className="text-lg font-bold">{formatCurrency(viewedClaim.totalAmount)}</p></div>
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-semibold text-emerald-600">Covered</p><p className="text-lg font-bold text-emerald-700">{formatCurrency(viewedClaim.coveredAmount)}</p></div>
                <div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-semibold text-amber-600">Excess</p><p className="text-lg font-bold text-amber-700">{formatCurrency(viewedClaim.patientExcess)}</p></div>
              </div>
              {viewedAuth && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Authorization</p>
                  <p className="text-sm">{viewedAuth.authorizationCode} — {providerMap.get(viewedAuth.hmoProviderId) ?? "—"}</p>
                </div>
              )}
              {viewedClaim.remarks && (
                <div><p className="text-xs font-semibold text-slate-500">Remarks</p><p className="text-sm text-slate-700">{viewedClaim.remarks}</p></div>
              )}
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
                <div><span className="font-semibold">Submitted:</span> {viewedClaim.submissionDate ? new Date(viewedClaim.submissionDate).toLocaleDateString("en-PH") : "—"}</div>
                <div><span className="font-semibold">Paid:</span> {viewedClaim.paidDate ? new Date(viewedClaim.paidDate).toLocaleDateString("en-PH") : "—"}</div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="secondary" onClick={() => setViewingClaim(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </InternalPage>
  );
}
