/**
 * HMO Payments — Record and track payments from HMOs against claims
 */
import { useState, useMemo, useDeferredValue } from "react";
import { Wallet, Plus, Search, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { FormField } from "../../components/forms/form-field";
import { INTERNAL_SURFACE, INTERNAL_TABLE, INTERNAL_TABLE_SCROLL, INTERNAL_THEAD_ROW, INTERNAL_TH, INTERNAL_TR, INTERNAL_TD } from "../../lib/internal-ui";
import { cn, formatCurrency } from "../../lib/utils";
import { useHmoPayments, useCreateHmoPayment, useHmoClaims } from "./api/hmo-hooks";
import { HmoStatusBadge } from "./components/hmo-status-badge";

export function HmoPaymentsContent() {
  const { data: payments = [], isLoading } = useHmoPayments();
  const { data: claims = [] } = useHmoClaims();
  const createMutation = useCreateHmoPayment();

  const claimMap = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [modalOpen, setModalOpen] = useState(false);

  const [formClaimId, setFormClaimId] = useState("");
  const [formRef, setFormRef] = useState("");
  const [formAmount, setFormAmount] = useState("0");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formMethod, setFormMethod] = useState("bank_transfer");
  const [formRemarks, setFormRemarks] = useState("");

  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        const claim = claimMap.get(p.claimId);
        return `${p.paymentReference} ${claim?.invoiceNumber ?? ""}`.toLowerCase().includes(deferredSearch.toLowerCase());
      }),
    [payments, deferredSearch, claimMap],
  );

  // Unpaid/partially paid claims for the dropdown
  const unpaidClaims = useMemo(
    () => claims.filter((c) => !["paid", "denied", "draft"].includes(c.claimStatus)),
    [claims],
  );

  // Overdue claims count
  const overdueCount = useMemo(
    () => claims.filter((c) => c.claimStatus === "overdue").length,
    [claims],
  );

  const totalCollected = useMemo(
    () => payments.reduce((s, p) => s + p.amountPaid, 0),
    [payments],
  );

  function openCreate() {
    setFormClaimId(unpaidClaims[0]?.id ?? "");
    setFormRef("");
    setFormAmount("0");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormMethod("bank_transfer");
    setFormRemarks("");
    setModalOpen(true);
  }

  async function handleCreate() {
    if (!formClaimId) { toast.error("Select a claim"); return; }
    try {
      await createMutation.mutateAsync({
        claimId: formClaimId,
        paymentReference: formRef.trim(),
        amountPaid: Number(formAmount) || 0,
        paymentDate: new Date(formDate).toISOString(),
        paymentMethod: formMethod,
        remarks: formRemarks.trim(),
      });
      toast.success("Payment recorded");
      setModalOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <>
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{background:'color-mix(in srgb, var(--color-primary) 14%, white)'}}><Wallet className="size-5" style={{color:'var(--color-primary)'}} /></div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">HMO Management</p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Payments</h1>
              <p className="mt-1 text-sm text-slate-500">Record and track reimbursements from HMO providers.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={openCreate}><Plus className="mr-2 size-4" /> Record Payment</Button>
            <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" onChange={(e) => setSearch(e.target.value)} placeholder="Search reference…" value={search} />
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50/90 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">{filtered.length} payment{filtered.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 ring-1 ring-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-700">Total Collected: {formatCurrency(totalCollected)}</span>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 ring-1 ring-rose-100">
              <AlertTriangle className="size-3 text-rose-600" />
              <span className="text-[11px] font-semibold text-rose-700">{overdueCount} Overdue Claim{overdueCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </section>

      <section className={INTERNAL_SURFACE}>
        <div className={INTERNAL_TABLE_SCROLL}>
          <table className={INTERNAL_TABLE}>
            <thead><tr className={INTERNAL_THEAD_ROW}>
              <th className={INTERNAL_TH}>Invoice #</th>
              <th className={INTERNAL_TH}>Reference</th>
              <th className={INTERNAL_TH}>Amount</th>
              <th className={INTERNAL_TH}>Method</th>
              <th className={INTERNAL_TH}>Date</th>
              <th className={INTERNAL_TH}>Claim Status</th>
              <th className={INTERNAL_TH}>Remarks</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">No payments recorded</td></tr>
              ) : filtered.map((p) => {
                const claim = claimMap.get(p.claimId);
                return (
                  <tr key={p.id} className={INTERNAL_TR}>
                    <td className={INTERNAL_TD}><span className="font-semibold text-slate-900">{claim?.invoiceNumber || "—"}</span></td>
                    <td className={INTERNAL_TD}>{p.paymentReference || "—"}</td>
                    <td className={INTERNAL_TD}><span className="font-semibold text-emerald-700">{formatCurrency(p.amountPaid)}</span></td>
                    <td className={INTERNAL_TD}><span className="capitalize">{p.paymentMethod.replace(/_/g, " ")}</span></td>
                    <td className={INTERNAL_TD}>{new Date(p.paymentDate).toLocaleDateString("en-PH")}</td>
                    <td className={INTERNAL_TD}>{claim ? <HmoStatusBadge status={claim.claimStatus} type="claim" /> : "—"}</td>
                    <td className={INTERNAL_TD}><span className="text-xs text-slate-500">{p.remarks || "—"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">HMO Management</p>
                <h2 className="mt-1 text-base font-bold text-slate-900">Record Payment</h2>
              </div>
              <button className="inline-flex shrink-0 items-center justify-center border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50" onClick={() => setModalOpen(false)} type="button"><X className="size-4" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <FormField label="Claim *">
                <Select value={formClaimId} onChange={(e) => setFormClaimId(e.target.value)}>
                  <option value="">Select claim</option>
                  {unpaidClaims.map((c) => (
                    <option key={c.id} value={c.id}>{c.invoiceNumber || c.id.slice(0, 8)} — {formatCurrency(c.coveredAmount)} pending</option>
                  ))}
                </Select>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Amount Paid (₱)"><Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} min={0} /></FormField>
                <FormField label="Payment Date"><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Reference #"><Input value={formRef} onChange={(e) => setFormRef(e.target.value)} placeholder="Check/bank ref" /></FormField>
                <FormField label="Method">
                  <Select value={formMethod} onChange={(e) => setFormMethod(e.target.value)}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="check">Check</option>
                    <option value="online">Online</option>
                    <option value="cash">Cash</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Remarks"><Textarea value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} rows={2} /></FormField>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleCreate()} disabled={createMutation.isPending}>Record Payment</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
