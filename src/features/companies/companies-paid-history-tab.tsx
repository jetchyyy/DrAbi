import { useState, Fragment } from "react";
import { FileSpreadsheet, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { Button } from "../../components/ui/button";
import {
  INTERNAL_SURFACE,
  INTERNAL_TABLE,
  INTERNAL_TABLE_SCROLL,
  INTERNAL_THEAD_ROW,
  INTERNAL_TH,
  INTERNAL_TR,
  INTERNAL_TD,
} from "../../lib/internal-ui";
import { cn } from "../../lib/utils";

interface PaidHistoryItem {
  id: string;
  patientName: string;
  consultationDate: string;
  doctorName: string;
  serviceType: string;
  receiptCode: string;
  invoiceNo: string;
  consultationFee: number;
  paidDate: string;
  paidBy: string;
}

interface PaidHistoryGroup {
  id: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  totalConsultations: number;
  totalBilled: number;
  discountAmount: number;
  totalAmountPaid: number;
  paidDate: string;
  paidBy: string;
  items: PaidHistoryItem[];
}

interface CompaniesPaidHistoryTabProps {
  paidHistoryData: PaidHistoryGroup[];
  isPaymentHistoryLoading: boolean;
}

/** Print a PDF receipt for a paid history group */
function printPaymentReceiptAsPdf(group: PaidHistoryGroup) {
  const formatPeso = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemRows = group.items
    .map(
      (item) => `
    <tr>
      <td>${item.patientName}</td>
      <td>${item.consultationDate}</td>
      <td>${item.doctorName}</td>
      <td>${item.serviceType}</td>
      <td class="mono">${item.receiptCode || "—"}</td>
      <td class="mono">${item.invoiceNo || "—"}</td>
      <td class="right">${formatPeso(item.consultationFee)}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt – ${group.companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      padding: 32px;
    }
    .receipt {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 32px rgba(0,0,0,0.10);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #fff;
      padding: 28px 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-left h1 { font-size: 20px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .header-left p { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .badge {
      display: inline-block;
      margin-top: 10px;
      background: #22c55e;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 4px 14px;
      border-radius: 999px;
    }
    .header-right { text-align: right; }
    .header-right .company { font-size: 18px; font-weight: 700; }
    .header-right .code { font-size: 12px; color: #94a3b8; font-family: monospace; margin-top: 2px; }
    .body { padding: 28px 40px; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .meta-card .label { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta-card .value { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .meta-card .value.green { color: #15803d; }
    .items-title { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead tr { background: #f1f5f9; }
    thead th { padding: 8px 12px; text-align: left; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; border-bottom: 2px solid #e2e8f0; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:hover { background: #f8fafc; }
    td { padding: 8px 12px; color: #374151; }
    .mono { font-family: monospace; font-size: 11px; color: #6b7280; }
    .right { text-align: right; font-weight: 600; }
    .total-row { background: #f0fdf4; }
    .total-row td { font-weight: 700; color: #166534; font-size: 13px; padding: 10px 12px; border-top: 2px solid #86efac; }
    .footer { text-align: center; padding: 18px 40px 24px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }
    .footer strong { color: #64748b; }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt { box-shadow: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="header-left">
        <h1>Payment Receipt</h1>
        <p>Paid: ${group.paidDate}</p>
        <span class="badge">✓ PAID</span>
      </div>
      <div class="header-right">
        <div class="company">${group.companyName}</div>
        ${group.companyCode ? `<div class="code">Code: ${group.companyCode}</div>` : ""}
      </div>
    </div>
    <div class="body">
      <div class="meta-grid">
        <div class="meta-card">
          <div class="label">Total Consultations</div>
          <div class="value">${group.totalConsultations}</div>
        </div>
        <div class="meta-card">
          <div class="label">Total Billed</div>
          <div class="value">${formatPeso(group.totalBilled)}</div>
        </div>
        <div class="meta-card">
          <div class="label">Discount Applied</div>
          <div class="value">${formatPeso(group.discountAmount)}</div>
        </div>
      </div>

      <div class="items-title">Consultation Details</div>
      <table>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Consult Date</th>
            <th>Doctor</th>
            <th>Service</th>
            <th>Receipt</th>
            <th>Invoice</th>
            <th style="text-align:right">Fee</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows || `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">No consultation details linked to this payment.</td></tr>`}
          <tr class="total-row">
            <td colspan="6">Total Amount Paid</td>
            <td class="right">${formatPeso(group.totalAmountPaid)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="footer">
      <strong>Thank you for your payment!</strong><br/>
      Paid by: ${group.paidBy || "—"} &nbsp;|&nbsp; Please keep this receipt for your records.
    </div>
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) {
    toast.error("Please allow pop-ups to print the receipt.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

function handleExportPaidHistory(format: "excel" | "csv", groups: PaidHistoryGroup[]) {
  const dataToExport: any[] = [];
  groups.forEach((group) => {
    group.items.forEach((item) => {
      dataToExport.push({
        Company: group.companyName,
        "Company Code": group.companyCode,
        "Patient Name": item.patientName,
        "Consultation Date": item.consultationDate,
        Doctor: item.doctorName,
        "Service Type": item.serviceType,
        "Receipt Code": item.receiptCode,
        Invoice: item.invoiceNo,
        "Paid Fee (₱)": item.consultationFee,
        "Paid Date": item.paidDate,
        "Paid By": item.paidBy,
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Paid History");

  if (format === "excel") {
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `company-paid-history-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
    link.download = `company-paid-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  toast.success(`${format === "excel" ? "Excel" : "CSV"} export completed`);
}

export function CompaniesPaidHistoryTab({
  paidHistoryData,
  isPaymentHistoryLoading,
}: CompaniesPaidHistoryTabProps) {
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  const toggleCompanyExpanded = (id: string) => {
    setExpandedCompanies((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-white border-b border-slate-100">
        <Button variant="tertiary" onClick={() => handleExportPaidHistory("csv", paidHistoryData)}>
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
        <Button variant="primary" onClick={() => handleExportPaidHistory("excel", paidHistoryData)}>
          <FileSpreadsheet className="mr-2 size-4" /> Export Excel
        </Button>
      </div>

      <div className="p-6">
        <section className={INTERNAL_SURFACE}>
          <div className={INTERNAL_TABLE_SCROLL}>
            <table className={INTERNAL_TABLE}>
              <thead>
                <tr className={INTERNAL_THEAD_ROW}>
                  <th className="w-10"></th>
                  <th className={INTERNAL_TH}>Company</th>
                  <th className={INTERNAL_TH}>Company Code</th>
                  <th className={INTERNAL_TH}>Consultations</th>
                  <th className={INTERNAL_TH}>Total Billed</th>
                  <th className={INTERNAL_TH}>Discount</th>
                  <th className={INTERNAL_TH}>Amount Paid</th>
                  <th className={INTERNAL_TH}>Paid Date</th>
                  <th className={INTERNAL_TH}>Paid By</th>
                  <th className={INTERNAL_TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isPaymentHistoryLoading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-400">
                      Loading payment history…
                    </td>
                  </tr>
                ) : paidHistoryData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-400">
                      No paid billing transactions found
                    </td>
                  </tr>
                ) : (
                  paidHistoryData.map((group) => {
                    const isExpanded = !!expandedCompanies[group.id];
                    return (
                      <Fragment key={group.id}>
                        <tr className={cn(INTERNAL_TR, "bg-slate-50/40 hover:bg-slate-50")}>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleCompanyExpanded(group.id)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                          </td>
                          <td className={INTERNAL_TD}>
                            <span className="font-semibold text-slate-900">{group.companyName}</span>
                          </td>
                          <td className={INTERNAL_TD}>{group.companyCode || "—"}</td>
                          <td className={INTERNAL_TD}>{group.totalConsultations}</td>
                          <td className={INTERNAL_TD}>
                            ₱{group.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className={INTERNAL_TD}>
                            ₱{group.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className={INTERNAL_TD}>
                            <span className="font-bold text-emerald-600">
                              ₱{group.totalAmountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className={INTERNAL_TD}>{group.paidDate}</td>
                          <td className={INTERNAL_TD}>{group.paidBy || "—"}</td>
                          <td className={INTERNAL_TD}>
                            {/* Only Receipt button — no Mark Pending */}
                            <button
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                              onClick={() => printPaymentReceiptAsPdf(group)}
                              type="button"
                            >
                              🖨 Receipt
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail rows */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="bg-slate-50/30 px-6 py-4 border-b border-slate-100">
                              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                      <th className="px-4 py-2">Patient Name</th>
                                      <th className="px-4 py-2">Consultation Date</th>
                                      <th className="px-4 py-2">Doctor</th>
                                      <th className="px-4 py-2">Service Type</th>
                                      <th className="px-4 py-2">Receipt Code</th>
                                      <th className="px-4 py-2">Invoice</th>
                                      <th className="px-4 py-2 text-right">Fee</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs">
                                    {group.items.length === 0 ? (
                                      <tr>
                                        <td colSpan={7} className="px-4 py-4 text-center text-slate-400">
                                          No detailed consultations linked to this payment.
                                        </td>
                                      </tr>
                                    ) : (
                                      group.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/60">
                                          <td className="px-4 py-2.5 font-semibold text-slate-800">{item.patientName}</td>
                                          <td className="px-4 py-2.5 text-slate-600">{item.consultationDate}</td>
                                          <td className="px-4 py-2.5 text-slate-600">{item.doctorName}</td>
                                          <td className="px-4 py-2.5 text-slate-500">{item.serviceType}</td>
                                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{item.receiptCode || "—"}</td>
                                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{item.invoiceNo || "—"}</td>
                                          <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                                            ₱{item.consultationFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
