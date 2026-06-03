import { useState } from "react";
import { FileSpreadsheet, Download, X } from "lucide-react";
import * as XLSX from "xlsx";

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
import { StatusPill } from "../../components/ui/status-pill";
import { toast } from "sonner";
import type { Company } from "../../types/domain";

interface SummaryRow {
  id: string;
  companyName: string;
  companyCode: string;
  totalConsultations: number;
  totalBilled: number;
  discountAmount: number;
  totalAmountDue: number;
  paymentStatus: string;
}

interface CompaniesSummaryTabProps {
  companies: Company[];
  filteredSummaryReport: SummaryRow[];
  summaryReportData: SummaryRow[];
  summaryCompanyId: string;
  onSummaryCompanyIdChange: (id: string) => void;
  isLoadingData: boolean;
  updateCompanyBillingSummaryMutation: any;
  onMarkPaidSuccess: () => void; // callback to switch to paid_history tab
}

/** Opens a print-friendly PDF receipt in a new window */
function printPaymentReceiptAsPdf(row: {
  companyName: string;
  companyCode: string;
  totalConsultations: number;
  totalBilled: number;
  discountAmount: number;
  totalAmountDue: number;
}) {
  const dateStr = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formatPeso = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt – ${row.companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      padding: 40px;
    }
    .receipt {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 32px rgba(0,0,0,0.10);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #ffffff;
      padding: 32px 40px;
      text-align: center;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .header p {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 6px;
    }
    .badge {
      display: inline-block;
      margin-top: 14px;
      background: #22c55e;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 4px 16px;
      border-radius: 999px;
    }
    .body {
      padding: 32px 40px;
    }
    .company-info {
      background: #f1f5f9;
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }
    .company-info .label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .company-info .value {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .company-info .code {
      font-size: 13px;
      color: #64748b;
      margin-top: 2px;
      font-family: monospace;
    }
    .divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      font-size: 14px;
    }
    .detail-row .dl { color: #64748b; }
    .detail-row .dv { font-weight: 600; color: #1e293b; }
    .total-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #86efac;
      border-radius: 10px;
      padding: 18px 20px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-box .tl {
      font-size: 14px;
      font-weight: 700;
      color: #166534;
    }
    .total-box .tv {
      font-size: 24px;
      font-weight: 800;
      color: #15803d;
    }
    .footer {
      text-align: center;
      padding: 20px 40px 28px;
      color: #94a3b8;
      font-size: 12px;
      border-top: 1px solid #f1f5f9;
    }
    .footer strong { color: #64748b; }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt { box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>Payment Receipt</h1>
      <p>${dateStr}</p>
      <span class="badge">✓ PAID</span>
    </div>
    <div class="body">
      <div class="company-info">
        <div class="label">Company</div>
        <div class="value">${row.companyName}</div>
        ${row.companyCode ? `<div class="code">Code: ${row.companyCode}</div>` : ""}
      </div>

      <div class="detail-row">
        <span class="dl">Total Consultations</span>
        <span class="dv">${row.totalConsultations}</span>
      </div>
      <hr class="divider" />
      <div class="detail-row">
        <span class="dl">Total Amount Billed</span>
        <span class="dv">${formatPeso(row.totalBilled)}</span>
      </div>
      <div class="detail-row">
        <span class="dl">Discount Applied</span>
        <span class="dv" style="color:#16a34a">− ${formatPeso(row.discountAmount)}</span>
      </div>

      <div class="total-box">
        <span class="tl">Total Amount Paid</span>
        <span class="tv">${formatPeso(row.totalAmountDue)}</span>
      </div>
    </div>
    <div class="footer">
      <strong>Thank you for your payment!</strong><br/>
      Please keep this receipt for your records.
    </div>
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=700,height=900");
  if (!win) {
    toast.error("Please allow pop-ups to print the receipt.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

function handleExportSummary(
  format: "excel" | "csv",
  rows: SummaryRow[],
) {
  const dataToExport = rows.map((row) => ({
    "Company Name": row.companyName,
    "Company Code": row.companyCode,
    "Total Consultations": row.totalConsultations,
    "Total Billed (₱)": row.totalBilled,
    "Discount Applied (₱)": row.discountAmount,
    "Total Amount Due (₱)": row.totalAmountDue,
    Status: row.paymentStatus.toUpperCase(),
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

export function CompaniesSummaryTab({
  companies,
  filteredSummaryReport,
  summaryReportData,
  summaryCompanyId,
  onSummaryCompanyIdChange,
  isLoadingData,
  updateCompanyBillingSummaryMutation,
  onMarkPaidSuccess,
}: CompaniesSummaryTabProps) {
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountCompanyId, setDiscountCompanyId] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-white border-b border-slate-100">
        <Button variant="tertiary" onClick={() => handleExportSummary("csv", filteredSummaryReport)}>
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
        <Button variant="primary" onClick={() => handleExportSummary("excel", filteredSummaryReport)}>
          <FileSpreadsheet className="mr-2 size-4" /> Export Excel
        </Button>
      </div>

      <div className="space-y-6 p-6">
        {/* KPI cards */}
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

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-900">Summary Report Filters</h3>
            {summaryCompanyId && (
              <button
                onClick={() => onSummaryCompanyIdChange("")}
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
                onChange={(e) => onSummaryCompanyIdChange(e.target.value)}
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

        {/* Table */}
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
                          {row.paymentStatus !== "paid" && (
                            <button
                              className="inline-flex items-center justify-center rounded-lg border border-transparent bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                              onClick={() => {
                                // First print receipt
                                printPaymentReceiptAsPdf(row);
                                // Then mark as paid and navigate to history
                                updateCompanyBillingSummaryMutation.mutate(
                                  {
                                    companyId: row.id,
                                    input: { payment_status: "paid" },
                                  },
                                  {
                                    onSuccess: () => {
                                      toast.success("Marked as paid — moved to Payment History");
                                      onMarkPaidSuccess();
                                    },
                                  }
                                );
                              }}
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

      {/* Discount Modal */}
      {discountModalOpen && discountCompanyId && (() => {
        const company = companies.find((c) => c.id === discountCompanyId);
        if (!company) return null;

        const summaryRow = summaryReportData.find((row) => row.id === discountCompanyId);
        const totalBilled = summaryRow ? summaryRow.totalBilled : 0;
        const discountValue = Number(discountInput) || 0;
        const prospectiveTotal = Math.max(0, totalBilled - discountValue);

        return (
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
                  disabled={updateCompanyBillingSummaryMutation.isPending}
                  onClick={() => {
                    updateCompanyBillingSummaryMutation.mutate(
                      {
                        companyId: discountCompanyId,
                        input: { discount_amount: discountValue },
                      },
                      {
                        onSuccess: () => {
                          toast.success("Discount applied successfully");
                          setDiscountModalOpen(false);
                          setDiscountCompanyId(null);
                        },
                        onError: (err: any) => {
                          toast.error(err instanceof Error ? err.message : "Failed to apply discount");
                        },
                      }
                    );
                  }}
                >
                  {updateCompanyBillingSummaryMutation.isPending ? "Applying..." : "Apply Discount"}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
