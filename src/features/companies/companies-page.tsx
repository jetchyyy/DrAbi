import { useDeferredValue, useMemo, useState } from "react";
import { Building2, Plus, Pencil, Trash2, Search, X, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import { cn, formatDateTimeLabel } from "../../lib/utils";
import { StatusPill } from "../../components/ui/status-pill";
import {
  useCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
} from "./api/companies-hooks";
import { useAppointments } from "../appointments/hooks/use-appointments";
import { useInvoices, useInvoiceItems } from "../billing/api/billing-mutations";
import { usePatients } from "../patients/hooks/use-patients";
import { useProviderDirectory, useServicesCatalog } from "../../hooks/use-clinic-data";
import type { Company } from "../../types/domain";
import * as XLSX from "xlsx";

// Helper functions for company billing summaries table
async function getCompanyBillingSummariesLiveOrDemo() {
  const { supabase } = await import("../../lib/supabase");
  if (!supabase) {
    const localData = localStorage.getItem("odyssey-clinic-company-billing-summaries");
    return localData ? JSON.parse(localData) : [];
  }
  const { data, error } = await supabase
    .from("company_billing_summaries")
    .select("*");
  if (error) throw error;
  return data || [];
}

async function upsertCompanyBillingSummaryLiveOrDemo(
  companyId: string,
  payload: { payment_status?: "paid" | "unpaid"; discount_amount?: number }
) {
  const { supabase } = await import("../../lib/supabase");
  if (!supabase) {
    const localData = localStorage.getItem("odyssey-clinic-company-billing-summaries");
    const list = localData ? JSON.parse(localData) : [];
    const index = list.findIndex((item: any) => item.company_id === companyId);
    const existing = index >= 0 ? list[index] : { company_id: companyId, payment_status: "unpaid", discount_amount: 0 };
    
    const updated = {
      ...existing,
      ...payload,
      updated_at: new Date().toISOString()
    };
    
    if (index >= 0) {
      list[index] = updated;
    } else {
      list.push(updated);
    }
    localStorage.setItem("odyssey-clinic-company-billing-summaries", JSON.stringify(list));
    return;
  }
  
  const { error } = await supabase
    .from("company_billing_summaries")
    .upsert({
      company_id: companyId,
      ...payload,
      updated_at: new Date().toISOString()
    }, { onConflict: "company_id" });
    
  if (error) throw error;
}

export function CompaniesPage() {
  const queryClient = useQueryClient();
  const { data: companies = [], isLoading: isCompaniesLoading } = useCompanies();
  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();
  const deleteMutation = useDeleteCompany();

  // Tab State
  const [activeTab, setActiveTab] = useState<"directory" | "summary" | "detailed">("directory");

  // Detailed Report Filters State
  const [detailedSearch, setDetailedSearch] = useState("");
  const [detailedCompanyId, setDetailedCompanyId] = useState("");
  const [detailedStatus, setDetailedStatus] = useState("");
  const [detailedStartDate, setDetailedStartDate] = useState("");
  const [detailedEndDate, setDetailedEndDate] = useState("");

  // Summary Report Filters State
  const [summaryCompanyId, setSummaryCompanyId] = useState("");

  // Discount Modal State
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountCompanyId, setDiscountCompanyId] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");

  // Additional Queries
  const { data: appointments = [], isLoading: isAppointmentsLoading } = useAppointments();
  const { data: invoices = [], isLoading: isInvoicesLoading } = useInvoices();
  const { data: invoiceItems = [], isLoading: isItemsLoading } = useInvoiceItems();
  const { data: patients = [], isLoading: isPatientsLoading } = usePatients();
  const { data: doctors = [], isLoading: isDoctorsLoading } = useProviderDirectory();
  const { data: services = [], isLoading: isServicesLoading } = useServicesCatalog();

  // Fetch billing summaries
  const { data: billingSummaries = [], isLoading: isSummariesLoading } = useQuery({
    queryKey: ["company-billing-summaries"],
    queryFn: getCompanyBillingSummariesLiveOrDemo,
  });

  const billingSummariesMap = useMemo(() => {
    return new Map<string, { company_id: string; payment_status: "paid" | "unpaid"; discount_amount: number }>(
      billingSummaries.map((s: any) => [s.company_id, s])
    );
  }, [billingSummaries]);

  // Mutation to update billing summaries (payment status and/or discount amount)
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
      void queryClient.invalidateQueries({ queryKey: ["company-billing-summaries"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update billing info");
    },
  });

  const isLoadingData =
    isCompaniesLoading ||
    isAppointmentsLoading ||
    isInvoicesLoading ||
    isItemsLoading ||
    isPatientsLoading ||
    isDoctorsLoading ||
    isServicesLoading ||
    isSummariesLoading;

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
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

  const filtered = useMemo(
    () =>
      companies.filter((company) =>
        `${company.companyName} ${company.companyCode} ${company.contactPerson} ${company.contactEmail} ${company.contactPhone}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase()),
      ),
    [companies, deferredSearch],
  );

  // Mappings
  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const appointmentMap = useMemo(() => new Map(appointments.map((a) => [a.id, a])), [appointments]);

  const invoiceItemsMap = useMemo(() => {
    const map = new Map<string, typeof invoiceItems>();
    invoiceItems.forEach((item) => {
      const list = map.get(item.invoiceId) || [];
      list.push(item);
      map.set(item.invoiceId, list);
    });
    return map;
  }, [invoiceItems]);



  // Summary Report calculation
  const summaryReportData = useMemo(() => {
    return companies.map((company) => {
      // Prioritize receipt prefix match first, then appointment company, then invoice company
      const companyInvoices = invoices.filter((inv) => {
        const appointment = inv.appointmentId ? appointmentMap.get(inv.appointmentId) : null;
        const receiptCode = (appointment && appointment.receipt_code) || inv.invoiceNumber || "";
        
        let resolvedCompanyId = appointment?.companyId || inv.companyId;
        if (receiptCode) {
          const prefix = receiptCode.split("-")[0]?.toUpperCase();
          if (prefix) {
            const companyByCode = companies.find((c) => c.companyCode?.toUpperCase() === prefix);
            if (companyByCode) {
              resolvedCompanyId = companyByCode.id;
            }
          }
        }
        return resolvedCompanyId === company.id;
      });

      const consultationInvoicesCount = companyInvoices.filter((inv) => {
        const hasConsultationItem = (invoiceItemsMap.get(inv.id) || []).some(
          (item) => item.category === "consultation"
        );
        const hasAppointment = !!inv.appointmentId;
        return hasConsultationItem || hasAppointment;
      }).length;

      const totalBilled = companyInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      
      const billingSummary = billingSummariesMap.get(company.id);
      const paymentStatus = billingSummary?.payment_status || "unpaid";
      const discountVal = billingSummary?.discount_amount || 0;
      const isPaid = paymentStatus === "paid";
      const totalAmountDue = isPaid ? 0 : Math.max(0, totalBilled - discountVal);

      return {
        id: company.id,
        companyName: company.companyName,
        companyCode: company.companyCode,
        totalConsultations: consultationInvoicesCount,
        totalBilled,
        totalAmountDue,
        paymentStatus,
        discountAmount: discountVal,
      };
    });
  }, [companies, invoices, invoiceItemsMap, appointmentMap, billingSummariesMap]);

  const filteredSummaryReport = useMemo(() => {
    if (!summaryCompanyId) return summaryReportData;
    return summaryReportData.filter((row) => row.id === summaryCompanyId);
  }, [summaryReportData, summaryCompanyId]);

  // Detailed Report calculation
  const detailedReportData = useMemo(() => {
    const rows: Array<{
      id: string;
      companyId: string;
      companyName: string;
      patientName: string;
      consultationDate: string;
      doctorName: string;
      serviceType: string;
      receiptCode: string;
      subtotal: number;
      discountAmount: number;
      total: number;
      consultationFee: number;
      paymentStatus: string;
      rawDate: string;
    }> = [];

    // Prioritize receipt prefix match first, then appointment company, then invoice company
    const resolvedCompanyInvoices = invoices.map((inv) => {
      const appointment = inv.appointmentId ? appointmentMap.get(inv.appointmentId) : null;
      const receiptCode = (appointment && appointment.receipt_code) || inv.invoiceNumber || "";
      
      let resolvedCompanyId = appointment?.companyId || inv.companyId;
      if (receiptCode) {
        const prefix = receiptCode.split("-")[0]?.toUpperCase();
        if (prefix) {
          const companyByCode = companies.find((c) => c.companyCode?.toUpperCase() === prefix);
          if (companyByCode) {
            resolvedCompanyId = companyByCode.id;
          }
        }
      }
      return { invoice: inv, appointment, resolvedCompanyId, receiptCode };
    }).filter((item) => !!item.resolvedCompanyId);

    resolvedCompanyInvoices.forEach(({ invoice, appointment, resolvedCompanyId, receiptCode }) => {
      const company = companies.find((c) => c.id === resolvedCompanyId);
      const patient = patientMap.get(invoice.patientId);
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient";

      const rawDate = appointment ? appointment.scheduledAt : invoice.createdAt;
      const consultationDate = formatDateTimeLabel(rawDate);

      const doctor = appointment ? doctorMap.get(appointment.doctorId) : null;
      const doctorName = doctor ? doctor.fullName : "—";

      const service = appointment ? serviceMap.get(appointment.serviceId) : null;
      let serviceType = service ? service.name : "";

      const items = invoiceItemsMap.get(invoice.id) || [];

      if (!serviceType && items.length > 0) {
        serviceType = items[0].description;
      }
      if (!serviceType) {
        serviceType = "Consultation";
      }

      const consultationItems = items.filter((item) => item.category === "consultation");
      const consultationFee = consultationItems.length > 0
        ? consultationItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        : invoice.total;

      rows.push({
        id: invoice.id,
        companyId: resolvedCompanyId || "",
        companyName: company ? company.companyName : "Unknown Company",
        patientName,
        consultationDate,
        doctorName,
        serviceType,
        receiptCode,
        subtotal: invoice.subtotal || 0,
        discountAmount: invoice.discountAmount || 0,
        total: invoice.total || 0,
        consultationFee,
        paymentStatus: invoice.paymentStatus,
        rawDate,
      });
    });

    return rows.sort((left, right) => right.rawDate.localeCompare(left.rawDate));
  }, [invoices, companies, patientMap, appointmentMap, doctorMap, serviceMap, invoiceItemsMap]);

  // Filter Detailed Report
  const filteredDetailedReport = useMemo(() => {
    return detailedReportData.filter((row) => {
      if (detailedCompanyId && row.companyId !== detailedCompanyId) {
        return false;
      }
      if (detailedStatus && row.paymentStatus !== detailedStatus) {
        return false;
      }
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
          row.serviceType.toLowerCase().includes(term) ||
          row.companyName.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [detailedReportData, detailedCompanyId, detailedStatus, detailedStartDate, detailedEndDate, detailedSearch]);

  // Export handlers
  function handleExportSummary(format: "excel" | "csv") {
    const dataToExport = filteredSummaryReport.map((row) => ({
      "Company Name": row.companyName,
      "Company Code": row.companyCode,
      "Total Consultations": row.totalConsultations,
      "Total Billed (₱)": row.totalBilled,
      "Discount Applied (₱)": row.discountAmount,
      "Total Amount Due (₱)": row.totalAmountDue,
      "Status": row.paymentStatus.toUpperCase(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Summary Report");

    if (format === "excel") {
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `company-summary-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `company-summary-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    toast.success(`${format === "excel" ? "Excel" : "CSV"} export completed`);
  }

  function handleExportDetailed(format: "excel" | "csv") {
    const dataToExport = filteredDetailedReport.map((row) => ({
      "Company": row.companyName,
      "Patient Name": row.patientName,
      "Consultation Date": row.consultationDate,
      "Doctor": row.doctorName,
      "Service Type": row.serviceType,
      "Receipt Code": row.receiptCode,
      "Original Fee (₱)": row.subtotal,
      "Discount (₱)": row.discountAmount,
      "Total Charged (₱)": row.total,
      "Payment Status": row.paymentStatus.toUpperCase(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detailed Report");

    if (format === "excel") {
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `company-detailed-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `company-detailed-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    toast.success(`${format === "excel" ? "Excel" : "CSV"} export completed`);
  }


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
    <InternalPage>
      <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background:
                  "color-mix(in srgb, var(--color-primary) 14%, white)",
              }}
            >
              <Building2
                className="size-5"
                style={{ color: "var(--color-primary)" }}
              />
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
          <div className="flex flex-wrap items-center gap-3">
            {activeTab === "directory" && (
              <>
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="mr-2 size-4" /> Add Company
                </Button>
                <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <Search className="size-4 shrink-0 text-slate-400" />
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search companies…"
                    value={search}
                  />
                </div>
              </>
            )}
            {activeTab === "summary" && (
              <div className="flex items-center gap-2">
                <Button variant="tertiary" onClick={() => handleExportSummary("csv")}>
                  <Download className="mr-2 size-4" /> Export CSV
                </Button>
                <Button variant="primary" onClick={() => handleExportSummary("excel")}>
                  <FileSpreadsheet className="mr-2 size-4" /> Export Excel
                </Button>
              </div>
            )}
            {activeTab === "detailed" && (
              <div className="flex items-center gap-2">
                <Button variant="tertiary" onClick={() => handleExportDetailed("csv")}>
                  <Download className="mr-2 size-4" /> Export CSV
                </Button>
                <Button variant="primary" onClick={() => handleExportDetailed("excel")}>
                  <FileSpreadsheet className="mr-2 size-4" /> Export Excel
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/90 px-6 py-2.5">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            <button
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
                activeTab === "directory"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
              onClick={() => setActiveTab("directory")}
              type="button"
            >
              Company Directory
            </button>
            <button
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
                activeTab === "summary"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
              onClick={() => setActiveTab("summary")}
              type="button"
            >
              Summary Report
            </button>
            <button
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
                activeTab === "detailed"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
              onClick={() => setActiveTab("detailed")}
              type="button"
            >
              Detailed Report
            </button>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {activeTab === "directory" && `${filtered.length} compan${filtered.length === 1 ? "y" : "ies"}`}
            {activeTab === "summary" && `${summaryReportData.length} corporate accounts`}
            {activeTab === "detailed" && `${filteredDetailedReport.length} consultation billing records`}
          </span>
        </div>
      </section>

      {activeTab === "directory" && (
        <section className={INTERNAL_SURFACE}>
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
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm text-slate-400"
                    >
                      Loading companies…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm text-slate-400"
                    >
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
                      <td className={INTERNAL_TD}>
                        {company.companyCode || "—"}
                      </td>
                      <td className={INTERNAL_TD}>
                        <div className="text-sm">
                          {company.contactPerson || "—"}
                        </div>
                        {company.contactEmail ? (
                          <div className="text-xs text-slate-500">
                            {company.contactEmail}
                          </div>
                        ) : null}
                        {company.contactPhone ? (
                          <div className="text-xs text-slate-500">
                            {company.contactPhone}
                          </div>
                        ) : null}
                      </td>
                      <td className={INTERNAL_TD}>
                        {company.billingCycle || "—"}
                      </td>
                      <td className={INTERNAL_TD}>
                        {company.paymentTerms || "—"}
                      </td>
                      <td className={INTERNAL_TD}>
                        <StatusPill
                          status={company.isActive ? "active" : "inactive"}
                        />
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
        </section>
      )}

      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Consultations</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">
                {filteredSummaryReport.reduce((sum, r) => sum + r.totalConsultations, 0)}
              </h3>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Amount Billed</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">
                ₱{filteredSummaryReport.reduce((sum, r) => sum + r.totalBilled, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Amount Outstanding</p>
              <h3 className="mt-2 text-3xl font-bold text-rose-600">
                ₱{filteredSummaryReport.reduce((sum, r) => sum + r.totalAmountDue, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-slate-900">Summary Report Filters</h3>
              {summaryCompanyId && (
                <button
                  onClick={() => setSummaryCompanyId("")}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField label="Filter by Company">
                <Select
                  value={summaryCompanyId}
                  onChange={(e) => setSummaryCompanyId(e.target.value)}
                >
                  <option value="">All Companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </div>

          <section className={INTERNAL_SURFACE}>
            <div className={INTERNAL_TABLE_SCROLL}>
              <table className={INTERNAL_TABLE}>
                <thead>
                  <tr className={INTERNAL_THEAD_ROW}>
                    <th className={INTERNAL_TH}>Company Name</th>
                    <th className={INTERNAL_TH}>Company Code</th>
                    <th className={INTERNAL_TH}>Total Consultations</th>
                    <th className={INTERNAL_TH}>Total Billed</th>
                    <th className={INTERNAL_TH}>Total Amount Due</th>
                    <th className={INTERNAL_TH}>Status</th>
                    <th className={INTERNAL_TH}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingData ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                        Loading summary report…
                      </td>
                    </tr>
                  ) : filteredSummaryReport.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                        No corporate data found
                      </td>
                    </tr>
                  ) : (
                    filteredSummaryReport.map((row) => (
                      <tr key={row.id} className={INTERNAL_TR}>
                        <td className={INTERNAL_TD}>
                          <span className="font-semibold text-slate-900">{row.companyName}</span>
                        </td>
                        <td className={INTERNAL_TD}>{row.companyCode || "—"}</td>
                        <td className={INTERNAL_TD}>{row.totalConsultations}</td>
                        <td className={INTERNAL_TD}>
                          ₱{row.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className={INTERNAL_TD}>
                          {row.paymentStatus === "paid" ? (
                            <span className="text-slate-500 font-semibold">₱0.00</span>
                          ) : row.discountAmount > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-400 line-through">
                                ₱{row.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                              <span className="font-semibold text-rose-600">
                                ₱{row.totalAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-emerald-600 font-medium leading-none mt-0.5">
                                (Disc: ₱{row.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                              </span>
                            </div>
                          ) : (
                            <span className="font-semibold text-rose-600">
                              ₱{row.totalAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>
                        <td className={INTERNAL_TD}>
                          <StatusPill status={row.paymentStatus} size="sm" />
                        </td>
                        <td className={INTERNAL_TD}>
                          <div className="flex items-center gap-1.5">
                            {row.paymentStatus === "paid" ? (
                              <button
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                                onClick={() =>
                                  updateCompanyBillingSummaryMutation.mutate({
                                    companyId: row.id,
                                    input: { payment_status: "unpaid" },
                                  })
                                }
                                disabled={updateCompanyBillingSummaryMutation.isPending}
                                type="button"
                              >
                                {updateCompanyBillingSummaryMutation.isPending &&
                                updateCompanyBillingSummaryMutation.variables?.companyId === row.id &&
                                updateCompanyBillingSummaryMutation.variables?.input.payment_status === "unpaid"
                                  ? "Updating..."
                                  : "Mark Pending"}
                              </button>
                            ) : (
                              <button
                                className="inline-flex items-center justify-center rounded-lg border border-transparent bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                                onClick={() =>
                                  updateCompanyBillingSummaryMutation.mutate({
                                    companyId: row.id,
                                    input: { payment_status: "paid" },
                                  })
                                }
                                disabled={updateCompanyBillingSummaryMutation.isPending}
                                type="button"
                              >
                                {updateCompanyBillingSummaryMutation.isPending &&
                                updateCompanyBillingSummaryMutation.variables?.companyId === row.id &&
                                updateCompanyBillingSummaryMutation.variables?.input.payment_status === "paid"
                                  ? "Updating..."
                                  : "Mark Paid"}
                              </button>
                            )}
                            <button
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                              onClick={() => {
                                setDiscountCompanyId(row.id);
                                setDiscountInput(row.discountAmount > 0 ? String(row.discountAmount) : "");
                                setDiscountModalOpen(true);
                              }}
                              type="button"
                            >
                              Discount
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
        </div>
      )}

      {activeTab === "detailed" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-slate-900">Detailed Report Filters</h3>
              {(detailedSearch || detailedCompanyId || detailedStatus || detailedStartDate || detailedEndDate) && (
                <button
                  onClick={() => {
                    setDetailedSearch("");
                    setDetailedCompanyId("");
                    setDetailedStatus("");
                    setDetailedStartDate("");
                    setDetailedEndDate("");
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
              <FormField label="Search">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  <Search className="size-4 shrink-0 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Patient, doctor, code…"
                    className="w-full bg-transparent outline-none"
                    value={detailedSearch}
                    onChange={(e) => setDetailedSearch(e.target.value)}
                  />
                </div>
              </FormField>

              <FormField label="Company">
                <Select
                  value={detailedCompanyId}
                  onChange={(e) => setDetailedCompanyId(e.target.value)}
                >
                  <option value="">All Companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Status">
                <Select
                  value={detailedStatus}
                  onChange={(e) => setDetailedStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                </Select>
              </FormField>

              <FormField label="Start Date">
                <Input
                  type="date"
                  value={detailedStartDate}
                  onChange={(e) => setDetailedStartDate(e.target.value)}
                />
              </FormField>

              <FormField label="End Date">
                <Input
                  type="date"
                  value={detailedEndDate}
                  onChange={(e) => setDetailedEndDate(e.target.value)}
                />
              </FormField>
            </div>
          </div>

          <section className={INTERNAL_SURFACE}>
            <div className={INTERNAL_TABLE_SCROLL}>
              <table className={INTERNAL_TABLE}>
                <thead>
                  <tr className={INTERNAL_THEAD_ROW}>
                    <th className={INTERNAL_TH}>Company</th>
                    <th className={INTERNAL_TH}>Patient Name</th>
                    <th className={INTERNAL_TH}>Consultation Date</th>
                    <th className={INTERNAL_TH}>Doctor</th>
                    <th className={INTERNAL_TH}>Service Type</th>
                    <th className={INTERNAL_TH}>Receipt Code</th>
                    <th className={INTERNAL_TH}>Consultation Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingData ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                        Loading detailed report…
                      </td>
                    </tr>
                  ) : filteredDetailedReport.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                        No detailed consultation records match the filters
                      </td>
                    </tr>
                  ) : (
                    filteredDetailedReport.map((row) => (
                      <tr key={row.id} className={INTERNAL_TR}>
                        <td className={INTERNAL_TD}>{row.companyName}</td>
                        <td className={INTERNAL_TD}>
                          <span className="font-semibold text-slate-900">{row.patientName}</span>
                        </td>
                        <td className={INTERNAL_TD}>{row.consultationDate}</td>
                        <td className={INTERNAL_TD}>{row.doctorName}</td>
                        <td className={INTERNAL_TD}>
                          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                            {row.serviceType}
                          </span>
                        </td>
                        <td className={INTERNAL_TD}>
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            {row.receiptCode}
                          </span>
                        </td>
                        <td className={INTERNAL_TD}>
                          ₱{(row.consultationFee || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

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

      {discountModalOpen && discountCompanyId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
              <h2 className="text-lg font-bold">Apply Company Discount</h2>
              <button
                className="rounded-lg p-1 transition hover:bg-slate-700"
                onClick={() => {
                  setDiscountModalOpen(false);
                  setDiscountCompanyId(null);
                }}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            {(() => {
              const company = companies.find((c) => c.id === discountCompanyId);
              if (!company) return <div className="p-6 text-sm text-slate-500">Company not found</div>;

              // Calculate total billed for the company dynamically
              const companyInvoices = invoices.filter((inv) => {
                const appointment = inv.appointmentId ? appointmentMap.get(inv.appointmentId) : null;
                const receiptCode = (appointment && appointment.receipt_code) || inv.invoiceNumber || "";
                
                let resolvedCompanyId = appointment?.companyId || inv.companyId;
                if (receiptCode) {
                  const prefix = receiptCode.split("-")[0]?.toUpperCase();
                  if (prefix) {
                    const companyByCode = companies.find((c) => c.companyCode?.toUpperCase() === prefix);
                    if (companyByCode) {
                      resolvedCompanyId = companyByCode.id;
                    }
                  }
                }
                return resolvedCompanyId === discountCompanyId;
              });

              const totalBilled = companyInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
              const discountValue = Number(discountInput) || 0;
              const prospectiveTotal = Math.max(0, totalBilled - discountValue);
              
              return (
                <>
                  <div className="space-y-4 px-6 py-5">
                    <div className="rounded-xl bg-slate-50 p-4 space-y-2 text-sm text-slate-600 border border-slate-100">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Company:</span>
                        <span className="font-semibold text-slate-900">{company.companyName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Company Code:</span>
                        <span className="font-semibold text-slate-900">{company.companyCode || "—"}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200/60 pt-2 mt-2">
                        <span className="font-medium text-slate-500">Total Billed:</span>
                        <span className="font-semibold text-slate-900">₱{totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <FormField label="Discount Amount (₱)">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₱</span>
                        <Input
                          type="number"
                          min="0"
                          max={totalBilled}
                          step="0.01"
                          className="pl-8"
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </FormField>

                    <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-4 flex justify-between items-center text-sm">
                      <span className="font-semibold text-emerald-800">New Amount Due:</span>
                      <span className="text-lg font-bold text-emerald-950">
                        ₱{prospectiveTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setDiscountModalOpen(false);
                        setDiscountCompanyId(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      disabled={updateMutation.isPending}
                      onClick={() => {
                        updateMutation.mutate({
                          id: discountCompanyId,
                          input: { discountAmount: discountValue },
                        }, {
                          onSuccess: () => {
                            toast.success("Discount applied successfully");
                            setDiscountModalOpen(false);
                            setDiscountCompanyId(null);
                          },
                          onError: (err) => {
                            toast.error(err instanceof Error ? err.message : "Failed to apply discount");
                          }
                        });
                      }}
                    >
                      {updateMutation.isPending ? "Applying..." : "Apply Discount"}
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </InternalPage>
  );
}
