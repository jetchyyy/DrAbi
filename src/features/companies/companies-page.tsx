import { useDeferredValue, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { InternalPage } from "../../components/ui/internal-page";
import { INTERNAL_SURFACE } from "../../lib/internal-ui";
import { cn, formatDateTimeLabel } from "../../lib/utils";
import { useCompanies } from "./api/companies-hooks";

// Tab sub-components (each section is its own file for easier debugging)
import { CompaniesDirectoryTab } from "./companies-directory-tab";
import { CompaniesSummaryTab } from "./companies-summary-tab";
import { CompaniesDetailedTab } from "./companies-detailed-tab";
import { CompaniesPaidHistoryTab } from "./companies-paid-history-tab";

// ---------------------------------------------------------------------------
// Data-fetching helpers (kept in this file; they own the DB interaction)
// ---------------------------------------------------------------------------

async function getCompanyBillingSummaryLiveOrDemo() {
  const { supabase } = await import("../../lib/supabase");
  if (!supabase) {
    const localData = localStorage.getItem("odyssey-clinic-company-billing-summary");
    return localData ? JSON.parse(localData) : [];
  }
  const { data, error } = await supabase
    .from("company_billing_summary" as any)
    .select("*")
    .order("company_name");
  if (error) throw error;
  return data || [];
}

async function getCompanyBillingDetailedLiveOrDemo() {
  const { supabase } = await import("../../lib/supabase");
  if (!supabase) {
    const localData = localStorage.getItem("odyssey-clinic-company-billing-detailed");
    return localData ? JSON.parse(localData) : [];
  }
  const { data, error } = await supabase
    .from("company_billing_detailed" as any)
    .select("*, appointments(receipt_code)")
    .order("consultation_date", { ascending: false });
  if (error) throw error;
  // Prefer the appointment's receipt_code if available (always up-to-date)
  return (data || []).map((row: any) => ({
    ...row,
    receipt_code:
      (row.appointments as any)?.receipt_code ||
      row.receipt_code ||
      "",
  }));
}

async function getCompanyBillingPaymentHistoryLiveOrDemo() {
  const { supabase } = await import("../../lib/supabase");
  if (!supabase) {
    const localData = localStorage.getItem("odyssey-clinic-company-billing-payment-history");
    return localData ? JSON.parse(localData) : [];
  }
  const { data, error } = await supabase
    .from("company_billing_payment_history" as any)
    .select("*")
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function upsertCompanyBillingSummaryLiveOrDemo(
  companyId: string,
  payload: { payment_status?: "paid" | "unpaid"; discount_amount?: number }
) {
  const { supabase } = await import("../../lib/supabase");
  if (!supabase) {
    const summaryLocal = localStorage.getItem("odyssey-clinic-company-billing-summary");
    const summaryList = summaryLocal ? JSON.parse(summaryLocal) : [];
    let index = summaryList.findIndex((item: any) => item.company_id === companyId);

    if (index === -1) {
      const localDbStr = localStorage.getItem("odyssey-clinic-demo-db-v2");
      const db = localDbStr ? JSON.parse(localDbStr) : null;
      const companiesList = db?.companies || [];
      const company = companiesList.find((c: any) => c.id === companyId);

      const newSummary = {
        company_id: companyId,
        company_name: company ? company.companyName : "Unknown Company",
        company_code: company ? company.companyCode : "",
        total_consultations: 0,
        total_billed: 0,
        discount: 0,
        total_amount_due: 0,
        payment_status: "unpaid",
        updated_by: "admin@odyssey.clinic",
        updated_at: new Date().toISOString(),
      };
      summaryList.push(newSummary);
      index = summaryList.length - 1;
    }

    const existing = summaryList[index];
    let discount = payload.discount_amount !== undefined ? payload.discount_amount : existing.discount;

    if (payload.payment_status === "paid") {
      const detailedLocal = localStorage.getItem("odyssey-clinic-company-billing-detailed");
      const detailedList = detailedLocal ? JSON.parse(detailedLocal) : [];
      const unpaidList = detailedList.filter(
        (row: any) => row.company_id === companyId && row.billing_status === "unpaid"
      );

      if (unpaidList.length === 0) return;

      const totalConsultations = unpaidList.length;
      const totalBilled = unpaidList.reduce(
        (sum: number, row: any) => sum + Number(row.consultation_fee || 0),
        0
      );
      const discountApplied = existing ? Number(existing.discount || 0) : 0.0;
      const amountPaid = Math.max(0, totalBilled - discountApplied);

      const localDbStr = localStorage.getItem("odyssey-clinic-demo-db-v2");
      const db = localDbStr ? JSON.parse(localDbStr) : null;
      const company = db?.companies?.find((c: any) => c.id === companyId);
      const companyName = company ? company.companyName : existing ? existing.company_name : "Unknown Company";
      const companyCode = company ? company.companyCode : existing ? existing.company_code : "";

      const paymentId = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

      const historyLocal = localStorage.getItem("odyssey-clinic-company-billing-payment-history");
      const historyList = historyLocal ? JSON.parse(historyLocal) : [];
      historyList.push({
        id: paymentId,
        company_id: companyId,
        company_name: companyName,
        company_code: companyCode,
        total_consultations: totalConsultations,
        total_billed: totalBilled,
        discount_applied: discountApplied,
        amount_paid: amountPaid,
        paid_by: "admin@odyssey.clinic",
        paid_at: new Date().toISOString(),
      });
      localStorage.setItem(
        "odyssey-clinic-company-billing-payment-history",
        JSON.stringify(historyList)
      );

      detailedList.forEach((row: any) => {
        if (row.company_id === companyId && row.billing_status === "unpaid") {
          row.billing_status = "paid";
          row.payment_id = paymentId;
          row.updated_by = "admin@odyssey.clinic";
          row.updated_at = new Date().toISOString();
        }
      });
      localStorage.setItem(
        "odyssey-clinic-company-billing-detailed",
        JSON.stringify(detailedList)
      );

      summaryList[index] = {
        ...existing,
        payment_status: "paid",
        discount: 0,
        total_billed: 0,
        total_consultations: 0,
        total_amount_due: 0,
        updated_by: "admin@odyssey.clinic",
        updated_at: new Date().toISOString(),
      };
    } else if (payload.discount_amount !== undefined) {
      const totalAmountDue = Math.max(0, existing.total_billed - discount);
      summaryList[index] = {
        ...existing,
        discount: discount,
        total_amount_due: totalAmountDue,
        updated_by: "admin@odyssey.clinic",
        updated_at: new Date().toISOString(),
      };
    }
    localStorage.setItem("odyssey-clinic-company-billing-summary", JSON.stringify(summaryList));
    return;
  }

  // Live Supabase mode
  const { data: userData } = await supabase.auth.getUser();
  const updatedBy = userData?.user?.email || userData?.user?.id || "System";

  const { data: existingSummary } = await supabase
    .from("company_billing_summary" as any)
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!existingSummary) {
    const { data: company } = await supabase
      .from("companies" as any)
      .select("company_name, company_code")
      .eq("id", companyId)
      .single();

    const companyName = company ? (company as any).company_name : "Unknown Company";
    const companyCode = company ? (company as any).company_code : "";

    await supabase
      .from("company_billing_summary" as any)
      .insert({
        company_id: companyId,
        company_name: companyName,
        company_code: companyCode,
        total_consultations: 0,
        total_billed: 0,
        discount: 0,
        total_amount_due: 0,
        payment_status: "unpaid",
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      } as never);
  }

  if (payload.payment_status === "paid") {
    const { data: unpaidDetailedList } = await supabase
      .from("company_billing_detailed" as any)
      .select("*")
      .eq("company_id", companyId)
      .eq("billing_status", "unpaid");

    if (!unpaidDetailedList || unpaidDetailedList.length === 0) return;

    const totalConsultations = unpaidDetailedList.length;
    const totalBilled = unpaidDetailedList.reduce(
      (sum, row: any) => sum + Number(row.consultation_fee || 0),
      0
    );

    const { data: currentSummary } = await supabase
      .from("company_billing_summary" as any)
      .select("*")
      .eq("company_id", companyId)
      .single();

    const discountApplied = currentSummary ? Number((currentSummary as any).discount || 0) : 0.0;
    const amountPaid = Math.max(0, totalBilled - discountApplied);

    const { data: company } = await supabase
      .from("companies" as any)
      .select("company_name, company_code")
      .eq("id", companyId)
      .single();

    const companyName =
      company
        ? (company as any).company_name
        : existingSummary
        ? (existingSummary as any).company_name
        : "Unknown Company";
    const companyCode =
      company
        ? (company as any).company_code
        : existingSummary
        ? (existingSummary as any).company_code
        : "";

    const { data: paymentRecord, error: insertError } = await supabase
      .from("company_billing_payment_history" as any)
      .insert({
        company_id: companyId,
        company_name: companyName,
        company_code: companyCode,
        total_consultations: totalConsultations,
        total_billed: totalBilled,
        discount_applied: discountApplied,
        amount_paid: amountPaid,
        paid_by: updatedBy,
        paid_at: new Date().toISOString(),
      } as never)
      .select()
      .single();

    if (insertError) throw insertError;

    const paymentId = (paymentRecord as any).id;

    await supabase
      .from("company_billing_detailed" as any)
      .update({
        billing_status: "paid",
        payment_id: paymentId,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("company_id", companyId)
      .eq("billing_status", "unpaid");

    await supabase
      .from("company_billing_summary" as any)
      .update({
        payment_status: "paid",
        discount: 0.0,
        total_billed: 0.0,
        total_consultations: 0,
        total_amount_due: 0.0,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("company_id", companyId);
  } else if (payload.discount_amount !== undefined) {
    const { data: currentSummary } = await supabase
      .from("company_billing_summary" as any)
      .select("total_billed")
      .eq("company_id", companyId)
      .single();

    const totalBilled = currentSummary ? Number((currentSummary as any).total_billed || 0) : 0.0;
    const discount = payload.discount_amount;
    const totalAmountDue = Math.max(0, totalBilled - discount);

    await supabase
      .from("company_billing_summary" as any)
      .update({
        discount: discount,
        total_amount_due: totalAmountDue,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("company_id", companyId);
  }
}

// ---------------------------------------------------------------------------
// Main Page Component — thin shell
// ---------------------------------------------------------------------------

type TabId = "directory" | "summary" | "detailed" | "paid_history";

export function CompaniesPage() {
  const queryClient = useQueryClient();
  const { data: companies = [], isLoading: isCompaniesLoading } = useCompanies();

  // ── Tab State ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("directory");

  // ── Directory Search ───────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(
    () =>
      companies.filter((company) =>
        `${company.companyName} ${company.companyCode} ${company.contactPerson} ${company.contactEmail} ${company.contactPhone}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase())
      ),
    [companies, deferredSearch]
  );

  // ── Detailed Report Filters ────────────────────────────────────────────────
  const [detailedSearch, setDetailedSearch] = useState("");
  const [detailedCompanyId, setDetailedCompanyId] = useState("");
  const [detailedStartDate, setDetailedStartDate] = useState("");
  const [detailedEndDate, setDetailedEndDate] = useState("");

  // ── Summary Filter ─────────────────────────────────────────────────────────
  const [summaryCompanyId, setSummaryCompanyId] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: billingSummaryRows = [], isLoading: isSummaryRowsLoading } = useQuery({
    queryKey: ["company-billing-summary"],
    queryFn: getCompanyBillingSummaryLiveOrDemo,
  });

  const { data: billingDetailedRows = [], isLoading: isDetailedRowsLoading } = useQuery({
    queryKey: ["company-billing-detailed"],
    queryFn: getCompanyBillingDetailedLiveOrDemo,
  });

  const { data: billingPaymentHistoryRows = [], isLoading: isPaymentHistoryLoading } = useQuery({
    queryKey: ["company-billing-payment-history"],
    queryFn: getCompanyBillingPaymentHistoryLiveOrDemo,
  });

  // ── Mutation ───────────────────────────────────────────────────────────────
  const updateCompanyBillingSummaryMutation = useMutation({
    mutationFn: async ({
      companyId,
      input,
    }: {
      companyId: string;
      input: { payment_status?: "paid" | "unpaid"; discount_amount?: number };
    }) => {
      await upsertCompanyBillingSummaryLiveOrDemo(companyId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["company-billing-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["company-billing-detailed"] });
      void queryClient.invalidateQueries({ queryKey: ["company-billing-payment-history"] });
    },
    onError: (err) => {
      // toast errors are shown in child components or here
      import("sonner").then(({ toast }) => {
        toast.error(err instanceof Error ? err.message : "Failed to update billing info");
      });
    },
  });

  const isLoadingData =
    isCompaniesLoading || isSummaryRowsLoading || isDetailedRowsLoading || isPaymentHistoryLoading;

  // ── Derived Data ───────────────────────────────────────────────────────────

  const summaryReportData = useMemo(() => {
    return companies.map((company) => {
      const r = billingSummaryRows.find((row: any) => row.company_id === company.id);
      return {
        id: company.id,
        companyName: company.companyName,
        companyCode: company.companyCode,
        totalConsultations: r ? r.total_consultations : 0,
        totalBilled: r ? Number(r.total_billed || 0) : 0,
        discountAmount: r ? Number(r.discount || 0) : 0,
        totalAmountDue: r ? Number(r.total_amount_due || 0) : 0,
        paymentStatus: r ? r.payment_status : "unpaid",
      };
    });
  }, [companies, billingSummaryRows]);

  const paidHistoryData = useMemo(() => {
    return billingPaymentHistoryRows.map((p: any) => {
      const items = billingDetailedRows
        .filter((r: any) => r.payment_id === p.id)
        .map((r: any) => ({
          id: r.id,
          patientName: r.patient,
          consultationDate: formatDateTimeLabel(r.consultation_date),
          doctorName: r.doctor_name || "—",
          serviceType: r.service_type,
          receiptCode: r.receipt_code || "",
          invoiceNo: r.invoice_no || "",
          consultationFee: Number(r.consultation_fee || 0),
          paidDate: formatDateTimeLabel(r.updated_at || p.paid_at),
          paidBy: r.updated_by || p.paid_by || "System",
        }));

      return {
        id: p.id,
        companyId: p.company_id,
        companyName: p.company_name,
        companyCode: p.company_code,
        totalConsultations: p.total_consultations,
        totalBilled: Number(p.total_billed || 0),
        discountAmount: Number(p.discount_applied || 0),
        totalAmountPaid: Number(p.amount_paid || 0),
        paidDate: formatDateTimeLabel(p.paid_at),
        paidBy: p.paid_by,
        items,
      };
    });
  }, [billingPaymentHistoryRows, billingDetailedRows]);

  const filteredSummaryReport = useMemo(() => {
    if (!summaryCompanyId) return summaryReportData;
    return summaryReportData.filter((row) => row.id === summaryCompanyId);
  }, [summaryReportData, summaryCompanyId]);

  const detailedReportData = useMemo(() => {
    const rows = billingDetailedRows.map((r: any) => ({
      id: r.id,
      companyId: r.company_id,
      companyName: r.company,
      patientName: r.patient,
      consultationDate: formatDateTimeLabel(r.consultation_date),
      doctorName: r.doctor_name || "—",
      serviceType: r.service_type,
      receiptCode: r.receipt_code || "",
      invoiceNo: r.invoice_no || "",
      subtotal: Number(r.consultation_fee || 0),
      discountAmount: 0.0,
      total: Number(r.consultation_fee || 0),
      consultationFee: Number(r.consultation_fee || 0),
      paymentStatus: r.billing_status || "unpaid",
      rawDate: r.consultation_date || "",
    }));
    return rows.sort((left: any, right: any) => right.rawDate.localeCompare(left.rawDate));
  }, [billingDetailedRows]);

  const filteredDetailedReport = useMemo(() => {
    return detailedReportData.filter((row: any) => {
      if (row.paymentStatus !== "unpaid") return false;
      if (detailedCompanyId && row.companyId !== detailedCompanyId) return false;
      if (detailedStartDate) {
        const rowDateOnly = row.rawDate.slice(0, 10);
        if (rowDateOnly < detailedStartDate) return false;
      }
      if (detailedEndDate) {
        const rowDateOnly = row.rawDate.slice(0, 10);
        if (rowDateOnly > detailedEndDate) return false;
      }
      if (detailedSearch) {
        const term = detailedSearch.toLowerCase();
        return (
          row.patientName.toLowerCase().includes(term) ||
          row.doctorName.toLowerCase().includes(term) ||
          row.receiptCode.toLowerCase().includes(term) ||
          row.invoiceNo.toLowerCase().includes(term) ||
          row.serviceType.toLowerCase().includes(term) ||
          row.companyName.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [detailedReportData, detailedCompanyId, detailedStartDate, detailedEndDate, detailedSearch]);

  // ── Tab Pills Config ───────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; count: string }[] = [
    { id: "directory", label: "Company Directory", count: `${filtered.length} compan${filtered.length === 1 ? "y" : "ies"}` },
    { id: "summary", label: "Summary Report", count: `${summaryReportData.length} corporate accounts` },
    { id: "detailed", label: "Detailed Report", count: `${filteredDetailedReport.length} billing records` },
    { id: "paid_history", label: "Paid History", count: `${paidHistoryData.length} paid account${paidHistoryData.length === 1 ? "" : "s"}` },
  ];

  return (
    <InternalPage>
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "color-mix(in srgb, var(--color-primary) 14%, white)" }}
            >
              <Building2 className="size-5" style={{ color: "var(--color-primary)" }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Billing
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Companies
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage employer accounts, billing cycles, and payment terms.
              </p>
            </div>
          </div>
        </div>

        {/* ── Tab Pills ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/90 px-6 py-2.5">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
                  activeTab === tab.id
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs font-bold text-slate-500">
            {tabs.find((t) => t.id === activeTab)?.count}
          </span>
        </div>
      </section>

      {/* ── Tab Content ───────────────────────────────────────────────────────── */}

      {activeTab === "directory" && (
        <section className={INTERNAL_SURFACE}>
          <CompaniesDirectoryTab
            companies={companies}
            isCompaniesLoading={isCompaniesLoading}
            search={search}
            onSearchChange={setSearch}
            filtered={filtered}
          />
        </section>
      )}

      {activeTab === "summary" && (
        <section className={INTERNAL_SURFACE}>
          <CompaniesSummaryTab
            companies={companies}
            filteredSummaryReport={filteredSummaryReport}
            summaryReportData={summaryReportData}
            summaryCompanyId={summaryCompanyId}
            onSummaryCompanyIdChange={setSummaryCompanyId}
            isLoadingData={isLoadingData}
            updateCompanyBillingSummaryMutation={updateCompanyBillingSummaryMutation}
            onMarkPaidSuccess={() => setActiveTab("paid_history")}
          />
        </section>
      )}

      {activeTab === "detailed" && (
        <section className={INTERNAL_SURFACE}>
          <CompaniesDetailedTab
            companies={companies}
            filteredDetailedReport={filteredDetailedReport}
            detailedSearch={detailedSearch}
            detailedCompanyId={detailedCompanyId}
            detailedStartDate={detailedStartDate}
            detailedEndDate={detailedEndDate}
            onDetailedSearchChange={setDetailedSearch}
            onDetailedCompanyIdChange={setDetailedCompanyId}
            onDetailedStartDateChange={setDetailedStartDate}
            onDetailedEndDateChange={setDetailedEndDate}
            isLoadingData={isLoadingData}
          />
        </section>
      )}

      {activeTab === "paid_history" && (
        <section className={INTERNAL_SURFACE}>
          <CompaniesPaidHistoryTab
            paidHistoryData={paidHistoryData}
            isPaymentHistoryLoading={isPaymentHistoryLoading}
          />
        </section>
      )}
    </InternalPage>
  );
}
