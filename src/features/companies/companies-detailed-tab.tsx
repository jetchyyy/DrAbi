import { FileSpreadsheet, Download, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

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
import type { Company } from "../../types/domain";

interface DetailedRow {
  id: string;
  companyId: string;
  companyName: string;
  patientName: string;
  consultationDate: string;
  doctorName: string;
  serviceType: string;
  receiptCode: string;
  invoiceNo: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  consultationFee: number;
  paymentStatus: string;
  rawDate: string;
}

interface CompaniesDetailedTabProps {
  companies: Company[];
  filteredDetailedReport: DetailedRow[];
  detailedSearch: string;
  detailedCompanyId: string;
  detailedStartDate: string;
  detailedEndDate: string;
  onDetailedSearchChange: (v: string) => void;
  onDetailedCompanyIdChange: (v: string) => void;
  onDetailedStartDateChange: (v: string) => void;
  onDetailedEndDateChange: (v: string) => void;
  isLoadingData: boolean;
}

function handleExportDetailed(format: "excel" | "csv", rows: DetailedRow[]) {
  const dataToExport = rows.map((row) => ({
    Company: row.companyName,
    "Patient Name": row.patientName,
    "Consultation Date": row.consultationDate,
    Doctor: row.doctorName,
    "Service Type": row.serviceType,
    "Receipt Code": row.receiptCode,
    Invoice: row.invoiceNo,
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

export function CompaniesDetailedTab({
  companies,
  filteredDetailedReport,
  detailedSearch,
  detailedCompanyId,
  detailedStartDate,
  detailedEndDate,
  onDetailedSearchChange,
  onDetailedCompanyIdChange,
  onDetailedStartDateChange,
  onDetailedEndDateChange,
  isLoadingData,
}: CompaniesDetailedTabProps) {
  const hasFilters = !!(detailedSearch || detailedCompanyId || detailedStartDate || detailedEndDate);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-white border-b border-slate-100">
        <Button variant="tertiary" onClick={() => handleExportDetailed("csv", filteredDetailedReport)}>
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
        <Button variant="primary" onClick={() => handleExportDetailed("excel", filteredDetailedReport)}>
          <FileSpreadsheet className="mr-2 size-4" /> Export Excel
        </Button>
      </div>

      <div className="space-y-6 p-6">
        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-900">Detailed Report Filters</h3>
            {hasFilters && (
              <button
                onClick={() => {
                  onDetailedSearchChange("");
                  onDetailedCompanyIdChange("");
                  onDetailedStartDateChange("");
                  onDetailedEndDateChange("");
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <FormField label="Search">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  placeholder="Patient, doctor, code…"
                  className="w-full bg-transparent outline-none"
                  value={detailedSearch}
                  onChange={(e) => onDetailedSearchChange(e.target.value)}
                />
              </div>
            </FormField>

            <FormField label="Company">
              <Select
                value={detailedCompanyId}
                onChange={(e) => onDetailedCompanyIdChange(e.target.value)}
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Start Date">
              <Input
                type="date"
                value={detailedStartDate}
                onChange={(e) => onDetailedStartDateChange(e.target.value)}
              />
            </FormField>

            <FormField label="End Date">
              <Input
                type="date"
                value={detailedEndDate}
                onChange={(e) => onDetailedEndDateChange(e.target.value)}
              />
            </FormField>
          </div>
        </div>

        {/* Table */}
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
                  <th className={INTERNAL_TH}>Invoice</th>
                  <th className={INTERNAL_TH}>Consultation Fee</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingData ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">
                      Loading detailed report…
                    </td>
                  </tr>
                ) : filteredDetailedReport.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">
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
                          {row.receiptCode || "—"}
                        </span>
                      </td>
                      <td className={INTERNAL_TD}>
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {row.invoiceNo || "—"}
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
    </>
  );
}
