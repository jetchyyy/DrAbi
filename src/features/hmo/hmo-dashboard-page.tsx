/**
 * HMO Dashboard — KPI cards, charts, recent claims table
 */
import { useMemo } from "react";
import {
  ShieldCheck,
  DollarSign,
  FileCheck,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";
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
  LineChart,
  Line,
} from "recharts";

import { InternalPage } from "../../components/ui/internal-page";
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
import { useHmoClaims, useHmoAuthorizations, useHmoProviders, useHmoPayments } from "./api/hmo-hooks";
import { StatusPill } from "../../components/ui/status-pill";

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#06b6d4", "#8b5cf6"];

export function HmoDashboardPage() {
  const { data: claims = [], isLoading: claimsLoading } = useHmoClaims();
  const { data: authorizations = [] } = useHmoAuthorizations();
  const { data: providers = [] } = useHmoProviders();
  const { data: payments = [] } = useHmoPayments();

  const providerMap = useMemo(
    () => new Map(providers.map((p) => [p.id, p.name])),
    [providers],
  );

  // KPIs
  const totalReceivables = useMemo(
    () =>
      claims
        .filter((c) => !["paid", "denied"].includes(c.claimStatus))
        .reduce((sum, c) => sum + c.coveredAmount, 0),
    [claims],
  );

  const now = new Date();
  const claimsThisMonth = useMemo(
    () =>
      claims.filter((c) => {
        const d = new Date(c.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    [claims],
  );

  const claimsPaid = useMemo(
    () => claims.filter((c) => c.claimStatus === "paid").length,
    [claims],
  );

  const claimsOverdue = useMemo(
    () => claims.filter((c) => c.claimStatus === "overdue").length,
    [claims],
  );

  const pendingAuthorizations = useMemo(
    () => authorizations.filter((a) => a.approvalStatus === "pending").length,
    [authorizations],
  );

  // Monthly claims trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: { label: string; count: number; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.getMonth();
      const year = d.getFullYear();
      const label = d.toLocaleDateString("en-PH", {
        month: "short",
        year: "2-digit",
      });
      const monthClaims = claims.filter((c) => {
        const cd = new Date(c.createdAt);
        return cd.getMonth() === month && cd.getFullYear() === year;
      });
      months.push({
        label,
        count: monthClaims.length,
        amount: monthClaims.reduce((s, c) => s + c.totalAmount, 0),
      });
    }
    return months;
  }, [claims]);

  // Payment collections trend (last 6 months)
  const paymentTrend = useMemo(() => {
    const months: { label: string; collected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.getMonth();
      const year = d.getFullYear();
      const label = d.toLocaleDateString("en-PH", {
        month: "short",
        year: "2-digit",
      });
      const monthPayments = payments.filter((p) => {
        const pd = new Date(p.paymentDate);
        return pd.getMonth() === month && pd.getFullYear() === year;
      });
      months.push({
        label,
        collected: monthPayments.reduce((s, p) => s + p.amountPaid, 0),
      });
    }
    return months;
  }, [payments]);

  // Top HMO providers by claim volume
  const topProviders = useMemo(() => {
    // Group authorizations by provider, then count claims per provider
    const providerClaimMap = new Map<string, number>();
    for (const auth of authorizations) {
      const provName = providerMap.get(auth.hmoProviderId) ?? "Unknown";
      const count = claims.filter((c) => c.authorizationId === auth.id).length;
      providerClaimMap.set(provName, (providerClaimMap.get(provName) ?? 0) + count);
    }
    return Array.from(providerClaimMap.entries())
      .map(([name, count]) => ({ name, claims: count }))
      .sort((a, b) => b.claims - a.claims)
      .slice(0, 5);
  }, [authorizations, claims, providerMap]);

  // Aging analysis
  const agingData = useMemo(() => {
    const buckets = [
      { label: "0-30 Days", min: 0, max: 30, amount: 0 },
      { label: "31-60 Days", min: 31, max: 60, amount: 0 },
      { label: "61-90 Days", min: 61, max: 90, amount: 0 },
      { label: "91+ Days", min: 91, max: Infinity, amount: 0 },
    ];
    const nowMs = Date.now();
    for (const claim of claims) {
      if (["paid", "denied"].includes(claim.claimStatus)) continue;
      const submDate = claim.submissionDate
        ? new Date(claim.submissionDate).getTime()
        : new Date(claim.createdAt).getTime();
      const days = Math.floor((nowMs - submDate) / (1000 * 60 * 60 * 24));
      const bucket = buckets.find((b) => days >= b.min && days <= b.max);
      if (bucket) bucket.amount += claim.coveredAmount;
    }
    return buckets;
  }, [claims]);

  const recentClaims = useMemo(() => claims.slice(0, 8), [claims]);

  return (
    <InternalPage>
      {/* Header */}
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-teal-600 p-2.5 text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600">
                HMO Management
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                HMO Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Overview of HMO receivables, claims, and provider analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid gap-4 grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: "Total HMO Receivables",
            value: formatCurrency(totalReceivables),
            icon: DollarSign,
            hint: "Outstanding from HMOs",
          },
          {
            label: "Claims This Month",
            value: String(claimsThisMonth),
            icon: FileCheck,
            hint: "Submitted this period",
          },
          {
            label: "Claims Paid",
            value: String(claimsPaid),
            icon: TrendingUp,
            hint: "Total settled claims",
          },
          {
            label: "Overdue Claims",
            value: String(claimsOverdue),
            icon: AlertTriangle,
            hint: "Past payment due date",
          },
          {
            label: "Pending Authorizations",
            value: String(pendingAuthorizations),
            icon: Clock,
            hint: "Awaiting approval",
          },
        ].map((kpi) => (
          <div key={kpi.label} className={cn(INTERNAL_SURFACE, "p-5")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {kpi.label}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{kpi.hint}</p>
              </div>
              <div
                className="flex shrink-0 items-center justify-center rounded-xl p-2.5 ring-1 bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-[var(--color-primary)] ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]"
              >
                <kpi.icon className="size-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Charts */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* Monthly Claims Trend */}
        <div className={cn(INTERNAL_SURFACE, "p-5")}>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Monthly Claims Trend
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: any) => [formatCurrency(Number(value ?? 0)), "Amount"]}
              />
              <Bar
                dataKey="amount"
                fill="#16a34a"
                radius={[4, 4, 0, 0]}
                name="Claim Amount"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Collections */}
        <div className={cn(INTERNAL_SURFACE, "p-5")}>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Payment Collections
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={paymentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: any) => [
                  formatCurrency(Number(value ?? 0)),
                  "Collected",
                ]}
              />
              <Line
                type="monotone"
                dataKey="collected"
                stroke="#059669"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Collected"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top HMO Providers */}
        <div className={cn(INTERNAL_SURFACE, "p-5")}>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Top HMO Providers
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topProviders} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="claims" fill="#64748b" radius={[0, 4, 4, 0]} name="Claims" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Aging Analysis */}
        <div className={cn(INTERNAL_SURFACE, "p-5")}>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Claim Aging Analysis
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={agingData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name }: any) =>
                  name ?? ""
                }
                outerRadius={100}
                dataKey="amount"
                nameKey="label"
              >
                {agingData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => formatCurrency(Number(value ?? 0))}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent Claims Table */}
      <section className={cn(INTERNAL_SURFACE)}>
        <div className="flex items-center justify-between gap-4 border-b border-slate-100/90 px-6 py-4">
          <div>
            <p className="text-sm font-bold text-slate-900">Recent Claims</p>
            <p className="text-xs text-slate-500">
              Last {recentClaims.length} claims across all HMO providers
            </p>
          </div>
        </div>
        <div className={INTERNAL_TABLE_SCROLL}>
          <table className={INTERNAL_TABLE}>
            <thead>
              <tr className={INTERNAL_THEAD_ROW}>
                <th className={INTERNAL_TH}>Invoice #</th>
                <th className={INTERNAL_TH}>Total</th>
                <th className={INTERNAL_TH}>Covered</th>
                <th className={INTERNAL_TH}>Excess</th>
                <th className={INTERNAL_TH}>Status</th>
                <th className={INTERNAL_TH}>Date</th>
              </tr>
            </thead>
            <tbody>
              {claimsLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                    Loading claims…
                  </td>
                </tr>
              ) : recentClaims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                    No claims recorded yet
                  </td>
                </tr>
              ) : (
                recentClaims.map((claim) => (
                  <tr key={claim.id} className={INTERNAL_TR}>
                    <td className={INTERNAL_TD}>
                      <span className="font-medium text-slate-900">
                        {claim.invoiceNumber || "—"}
                      </span>
                    </td>
                    <td className={INTERNAL_TD}>
                      {formatCurrency(claim.totalAmount)}
                    </td>
                    <td className={INTERNAL_TD}>
                      {formatCurrency(claim.coveredAmount)}
                    </td>
                    <td className={INTERNAL_TD}>
                      {formatCurrency(claim.patientExcess)}
                    </td>
                    <td className={INTERNAL_TD}>
                      <StatusPill status={claim.claimStatus} />
                    </td>
                    <td className={INTERNAL_TD}>
                      {new Date(claim.createdAt).toLocaleDateString("en-PH")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </InternalPage>
  );
}
