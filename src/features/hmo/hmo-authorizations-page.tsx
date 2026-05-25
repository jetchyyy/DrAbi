/**
 * HMO Authorizations — LOA / authorization tracking with approval workflow
 */
import { useState, useMemo, useDeferredValue } from "react";
import { FileText, Plus, Search, X, Check, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { InternalPage } from "../../components/ui/internal-page";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { FormField } from "../../components/forms/form-field";
import { INTERNAL_SURFACE, INTERNAL_TABLE, INTERNAL_TABLE_SCROLL, INTERNAL_THEAD_ROW, INTERNAL_TH, INTERNAL_TR, INTERNAL_TD } from "../../lib/internal-ui";
import { cn, formatCurrency } from "../../lib/utils";
import { queryKeys } from "../../lib/query-keys";
import { listPatientsLiveOrDemo } from "../../lib/supabase-clinic";
import { useHmoAuthorizations, useCreateHmoAuthorization, useUpdateHmoAuthorization, useHmoProviders } from "./api/hmo-hooks";
import { StatusPill } from "../../components/ui/status-pill";
import { useAuth } from "../auth/auth-context";

export function HmoAuthorizationsPage() {
  const { profile } = useAuth();
  const { data: authorizations = [], isLoading } = useHmoAuthorizations();
  const { data: providers = [] } = useHmoProviders();
  const { data: patients = [] } = useQuery({ queryKey: queryKeys.patients, queryFn: listPatientsLiveOrDemo });
  const createMutation = useCreateHmoAuthorization();
  const updateMutation = useUpdateHmoAuthorization();

  const providerMap = useMemo(() => new Map(providers.map((p) => [p.id, p.name])), [providers]);
  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, `${p.firstName} ${p.lastName}`])), [patients]);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const [formPatientId, setFormPatientId] = useState("");
  const [formProviderId, setFormProviderId] = useState("");
  const [formAuthCode, setFormAuthCode] = useState("");
  const [formCoverage, setFormCoverage] = useState("0");
  const [formNotes, setFormNotes] = useState("");

  const filtered = useMemo(
    () =>
      authorizations.filter((a) => {
        const pName = patientMap.get(a.patientId) ?? "";
        const hName = providerMap.get(a.hmoProviderId) ?? "";
        const matchesSearch = `${pName} ${hName} ${a.authorizationCode}`.toLowerCase().includes(deferredSearch.toLowerCase());
        const matchesStatus = statusFilter === "all" || a.approvalStatus === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [authorizations, deferredSearch, statusFilter, patientMap, providerMap],
  );

  function openCreate() {
    setFormPatientId(patients[0]?.id ?? "");
    setFormProviderId(providers[0]?.id ?? "");
    setFormAuthCode("");
    setFormCoverage("0");
    setFormNotes("");
    setModalOpen(true);
  }

  async function handleCreate() {
    if (!formPatientId || !formProviderId) { toast.error("Patient and provider required"); return; }
    try {
      await createMutation.mutateAsync({
        patientId: formPatientId,
        appointmentId: null,
        hmoProviderId: formProviderId,
        authorizationCode: formAuthCode.trim(),
        coverageAmount: Number(formCoverage) || 0,
        approvalStatus: "pending",
        approvedBy: "",
        approvalDate: null,
        notes: formNotes.trim(),
      });
      toast.success("Authorization created");
      setModalOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleApprove(id: string) {
    try {
      await updateMutation.mutateAsync({
        id,
        input: { approvalStatus: "approved", approvedBy: profile?.fullName ?? "", approvalDate: new Date().toISOString() },
      });
      toast.success("Authorization approved");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleDeny(id: string) {
    try {
      await updateMutation.mutateAsync({ id, input: { approvalStatus: "denied", approvedBy: profile?.fullName ?? "", approvalDate: new Date().toISOString() } });
      toast.success("Authorization denied");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <InternalPage>
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-teal-600 p-2.5 text-white"><FileText className="size-5" /></div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">HMO Management</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Authorizations</h1>
              <p className="mt-1 text-sm text-slate-500">LOA tracking and authorization approval workflow.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={openCreate}><Plus className="mr-2 size-4" /> New Authorization</Button>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border-slate-200">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="expired">Expired</option>
            </Select>
            <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" onChange={(e) => setSearch(e.target.value)} placeholder="Search…" value={search} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50/90 px-6 py-2.5"><span className="text-xs font-bold text-slate-500">{filtered.length} authorization{filtered.length !== 1 ? "s" : ""}</span></div>
      </section>

      <section className={INTERNAL_SURFACE}>
        <div className={INTERNAL_TABLE_SCROLL}>
          <table className={INTERNAL_TABLE}>
            <thead><tr className={INTERNAL_THEAD_ROW}>
              <th className={INTERNAL_TH}>Patient</th>
              <th className={INTERNAL_TH}>HMO Provider</th>
              <th className={INTERNAL_TH}>Auth Code</th>
              <th className={INTERNAL_TH}>Coverage</th>
              <th className={INTERNAL_TH}>Status</th>
              <th className={INTERNAL_TH}>Approved By</th>
              <th className={INTERNAL_TH}>Date</th>
              <th className={INTERNAL_TH}>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">No authorizations found</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className={INTERNAL_TR}>
                  <td className={INTERNAL_TD}><span className="font-semibold text-slate-900">{patientMap.get(a.patientId) ?? "—"}</span></td>
                  <td className={INTERNAL_TD}>{providerMap.get(a.hmoProviderId) ?? "—"}</td>
                  <td className={INTERNAL_TD}><code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">{a.authorizationCode || "—"}</code></td>
                  <td className={INTERNAL_TD}>{formatCurrency(a.coverageAmount)}</td>
                  <td className={INTERNAL_TD}><StatusPill status={a.approvalStatus} /></td>
                  <td className={INTERNAL_TD}>{a.approvedBy || "—"}</td>
                  <td className={INTERNAL_TD}>{new Date(a.createdAt).toLocaleDateString("en-PH")}</td>
                  <td className={INTERNAL_TD}>
                    {a.approvalStatus === "pending" && (
                      <div className="flex gap-1">
                        <button className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50" onClick={() => void handleApprove(a.id)} title="Approve" type="button"><Check className="size-4" /></button>
                        <button className="rounded-lg p-1.5 text-rose-600 transition hover:bg-rose-50" onClick={() => void handleDeny(a.id)} title="Deny" type="button"><XCircle className="size-4" /></button>
                      </div>
                    )}
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
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
              <h2 className="text-lg font-bold">New Authorization</h2>
              <button className="rounded-lg p-1 transition hover:bg-slate-700" onClick={() => setModalOpen(false)} type="button"><X className="size-5" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <FormField label="Patient *">
                <Select value={formPatientId} onChange={(e) => setFormPatientId(e.target.value)}>
                  <option value="">Select patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </Select>
              </FormField>
              <FormField label="HMO Provider *">
                <Select value={formProviderId} onChange={(e) => setFormProviderId(e.target.value)}>
                  <option value="">Select provider</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Authorization Code"><Input value={formAuthCode} onChange={(e) => setFormAuthCode(e.target.value)} placeholder="LOA-XXXX" /></FormField>
                <FormField label="Coverage Amount (₱)"><Input type="number" value={formCoverage} onChange={(e) => setFormCoverage(e.target.value)} min={0} /></FormField>
              </div>
              <FormField label="Notes"><Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} /></FormField>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="tertiary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleCreate()} disabled={createMutation.isPending}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </InternalPage>
  );
}
