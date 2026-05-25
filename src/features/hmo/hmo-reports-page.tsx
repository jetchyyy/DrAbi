/**
 * HMO Reports — Aging analysis, collections summary, and PDF generation
 */
import { useMemo, useCallback } from "react";
import { FileText, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { jsPDF } from "jspdf";

import { Button } from "../../components/ui/button";
import { INTERNAL_SURFACE, INTERNAL_TABLE, INTERNAL_TABLE_SCROLL, INTERNAL_THEAD_ROW, INTERNAL_TH, INTERNAL_TR, INTERNAL_TD } from "../../lib/internal-ui";
import { cn, formatCurrency } from "../../lib/utils";
import { useHmoClaims, useHmoPayments, useHmoProviders, useHmoAuthorizations } from "./api/hmo-hooks";

const AGING_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444"];

export function HmoReportsContent() {
  const { data: claims = [] } = useHmoClaims();
  const { data: payments = [] } = useHmoPayments();
  const { data: providers = [] } = useHmoProviders();
  const { data: authorizations = [] } = useHmoAuthorizations();

  const providerMap = useMemo(() => new Map(providers.map((p) => [p.id, p.name])), [providers]);

  // Aging by provider
  const agingByProvider = useMemo(() => {
    const nowMs = Date.now();
    const result: Record<string, { name: string; "0-30": number; "31-60": number; "61-90": number; "91+": number; total: number }> = {};

    for (const claim of claims) {
      if (["paid", "denied"].includes(claim.claimStatus)) continue;

      // Find the provider via authorization
      const auth = authorizations.find((a) => a.id === claim.authorizationId);
      const provName = auth ? (providerMap.get(auth.hmoProviderId) ?? "Unknown") : "Unlinked";
      if (!result[provName]) result[provName] = { name: provName, "0-30": 0, "31-60": 0, "61-90": 0, "91+": 0, total: 0 };

      const submDate = claim.submissionDate ? new Date(claim.submissionDate).getTime() : new Date(claim.createdAt).getTime();
      const days = Math.floor((nowMs - submDate) / (1000 * 60 * 60 * 24));

      if (days <= 30) result[provName]["0-30"] += claim.coveredAmount;
      else if (days <= 60) result[provName]["31-60"] += claim.coveredAmount;
      else if (days <= 90) result[provName]["61-90"] += claim.coveredAmount;
      else result[provName]["91+"] += claim.coveredAmount;

      result[provName].total += claim.coveredAmount;
    }

    return Object.values(result).sort((a, b) => b.total - a.total);
  }, [claims, authorizations, providerMap]);

  // Aging pie totals
  const agingPieData = useMemo(() => {
    const totals = { "0-30 Days": 0, "31-60 Days": 0, "61-90 Days": 0, "91+ Days": 0 };
    for (const row of agingByProvider) {
      totals["0-30 Days"] += row["0-30"];
      totals["31-60 Days"] += row["31-60"];
      totals["61-90 Days"] += row["61-90"];
      totals["91+ Days"] += row["91+"];
    }
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [agingByProvider]);

  // Monthly collections
  const monthlyCollections = useMemo(() => {
    const months: { label: string; collected: number; claimed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.getMonth();
      const year = d.getFullYear();
      const label = d.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
      const collected = payments.filter((p) => { const pd = new Date(p.paymentDate); return pd.getMonth() === month && pd.getFullYear() === year; }).reduce((s, p) => s + p.amountPaid, 0);
      const claimed = claims.filter((c) => { const cd = new Date(c.createdAt); return cd.getMonth() === month && cd.getFullYear() === year; }).reduce((s, c) => s + c.coveredAmount, 0);
      months.push({ label, collected, claimed });
    }
    return months;
  }, [claims, payments]);

  // Most used providers
  const providerUsage = useMemo(() => {
    const usage = new Map<string, number>();
    for (const auth of authorizations) {
      const name = providerMap.get(auth.hmoProviderId) ?? "Unknown";
      usage.set(name, (usage.get(name) ?? 0) + 1);
    }
    return Array.from(usage.entries())
      .map(([name, count]) => ({ name, authorizations: count }))
      .sort((a, b) => b.authorizations - a.authorizations)
      .slice(0, 8);
  }, [authorizations, providerMap]);

  // PDF generation
  const generateAgingPdf = useCallback(() => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("HMO Claim Aging Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-PH")}`, 14, 28);

    let y = 40;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Provider", 14, y);
    doc.text("0-30 Days", 80, y);
    doc.text("31-60 Days", 105, y);
    doc.text("61-90 Days", 130, y);
    doc.text("91+ Days", 155, y);
    doc.text("Total", 180, y);
    y += 2;
    doc.line(14, y, 196, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    for (const row of agingByProvider) {
      doc.text(row.name.slice(0, 25), 14, y);
      doc.text(formatCurrency(row["0-30"]), 80, y);
      doc.text(formatCurrency(row["31-60"]), 105, y);
      doc.text(formatCurrency(row["61-90"]), 130, y);
      doc.text(formatCurrency(row["91+"]), 155, y);
      doc.text(formatCurrency(row.total), 180, y);
      y += 7;
      if (y > 270) { doc.addPage(); y = 20; }
    }

    // Grand totals
    y += 4;
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    const totals = agingPieData;
    doc.text("Grand Total", 14, y);
    doc.text(formatCurrency(totals[0]?.value ?? 0), 80, y);
    doc.text(formatCurrency(totals[1]?.value ?? 0), 105, y);
    doc.text(formatCurrency(totals[2]?.value ?? 0), 130, y);
    doc.text(formatCurrency(totals[3]?.value ?? 0), 155, y);
    doc.text(formatCurrency(totals.reduce((s, t) => s + t.value, 0)), 180, y);

    doc.save("hmo-aging-report.pdf");
  }, [agingByProvider, agingPieData]);

  const generateCollectionsPdf = useCallback(() => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("HMO Monthly Collections Summary", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-PH")}`, 14, 28);

    let y = 40;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Month", 14, y);
    doc.text("Claims Submitted", 60, y);
    doc.text("Payments Collected", 120, y);
    y += 2;
    doc.line(14, y, 196, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    for (const row of monthlyCollections) {
      doc.text(row.label, 14, y);
      doc.text(formatCurrency(row.claimed), 60, y);
      doc.text(formatCurrency(row.collected), 120, y);
      y += 7;
    }

    doc.save("hmo-collections-summary.pdf");
  }, [monthlyCollections]);

  return (
    <>
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{background:'color-mix(in srgb, var(--color-primary) 14%, white)'}}>
              <FileText className="size-5" style={{color:'var(--color-primary)'}} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">HMO Management</p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Reports</h1>
              <p className="mt-1 text-sm text-slate-500">Aging analysis, collections, and downloadable PDF reports.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" className="rounded-xl" onClick={generateAgingPdf}><Download className="mr-2 size-4" /> Aging Report PDF</Button>
            <Button variant="secondary" className="rounded-xl" onClick={generateCollectionsPdf}><Download className="mr-2 size-4" /> Collections PDF</Button>
          </div>
        </div>
      </section>

      {/* Aging Analysis */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className={cn(INTERNAL_SURFACE, "p-5")}>
          <h3 className="mb-4 text-sm font-bold text-slate-900">Claim Aging by Provider</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agingByProvider}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: any) => formatCurrency(Number(value ?? 0))} />
              <Legend />
              <Bar dataKey="0-30" stackId="aging" fill="#10b981" name="0-30 Days" />
              <Bar dataKey="31-60" stackId="aging" fill="#f59e0b" name="31-60 Days" />
              <Bar dataKey="61-90" stackId="aging" fill="#f97316" name="61-90 Days" />
              <Bar dataKey="91+" stackId="aging" fill="#ef4444" name="91+ Days" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={cn(INTERNAL_SURFACE, "p-5")}>
          <h3 className="mb-4 text-sm font-bold text-slate-900">Aging Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={agingPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name }: any) => name ?? ""}>
                {agingPieData.map((_e, i) => <Cell key={`c-${i}`} fill={AGING_COLORS[i % AGING_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any) => formatCurrency(Number(value ?? 0))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Monthly Collections */}
      <section className={cn(INTERNAL_SURFACE, "p-5")}>
        <h3 className="mb-4 text-sm font-bold text-slate-900">Monthly Collections vs Claims</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyCollections}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: any) => formatCurrency(Number(value ?? 0))} />
            <Legend />
            <Bar dataKey="claimed" fill="#6366f1" name="Claims Submitted" radius={[4, 4, 0, 0]} />
            <Bar dataKey="collected" fill="#10b981" name="Payments Collected" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Most Used Providers */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className={cn(INTERNAL_SURFACE, "p-5")}>
          <h3 className="mb-4 text-sm font-bold text-slate-900">Most Used HMO Providers</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={providerUsage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="authorizations" fill="#0d9488" radius={[0, 4, 4, 0]} name="Authorizations" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Aging table */}
        <div className={INTERNAL_SURFACE}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-900">Aging Summary Table</h3>
          </div>
          <div className={INTERNAL_TABLE_SCROLL}>
            <table className={INTERNAL_TABLE}>
              <thead><tr className={INTERNAL_THEAD_ROW}>
                <th className={INTERNAL_TH}>Provider</th>
                <th className={INTERNAL_TH}>0-30d</th>
                <th className={INTERNAL_TH}>31-60d</th>
                <th className={INTERNAL_TH}>61-90d</th>
                <th className={INTERNAL_TH}>91+d</th>
                <th className={INTERNAL_TH}>Total</th>
              </tr></thead>
              <tbody>
                {agingByProvider.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">No outstanding claims</td></tr>
                ) : agingByProvider.map((row) => (
                  <tr key={row.name} className={INTERNAL_TR}>
                    <td className={INTERNAL_TD}><span className="font-semibold text-slate-900">{row.name}</span></td>
                    <td className={INTERNAL_TD}>{formatCurrency(row["0-30"])}</td>
                    <td className={INTERNAL_TD}>{formatCurrency(row["31-60"])}</td>
                    <td className={INTERNAL_TD}>{formatCurrency(row["61-90"])}</td>
                    <td className={cn(INTERNAL_TD, row["91+"] > 0 && "text-rose-700 font-semibold")}>{formatCurrency(row["91+"])}</td>
                    <td className={INTERNAL_TD}><span className="font-bold">{formatCurrency(row.total)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
