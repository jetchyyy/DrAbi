import { formatCurrency } from "../../lib/utils";
import type { PosPaymentMethod } from "../../types/domain";

type PosReceiptLineItem = {
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

interface PosReceiptPrintDocumentInput {
  saleNumber: string;
  customerName: string;
  doctorAssignedName: string;
  receptionistName: string;
  paymentMethod: PosPaymentMethod;
  paymentReference: string | null;
  issuedAt: string;
  subtotal: number;
  total: number;
  items: PosReceiptLineItem[];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function buildReceiptRows(items: PosReceiptLineItem[]) {
  const rows = items.map(
    (entry) => `
      <tr>
        <td class="description">${escapeHtml(entry.itemName)}</td>
        <td class="qty">${entry.quantity}</td>
        <td class="price">${formatCurrency(entry.unitPrice)}</td>
        <td class="amount">${formatCurrency(entry.lineTotal)}</td>
      </tr>`,
  );

  const blankRows = Array.from({ length: Math.max(0, 3 - items.length) }).map(
    () => `
      <tr class="blank-row">
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
      </tr>`,
  );

  return [...rows, ...blankRows].join("");
}

export function buildPosReceiptPrintDocument(
  input: PosReceiptPrintDocumentInput,
) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>POS Receipt</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, Helvetica, sans-serif;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @page {
        size: A4 portrait;
        margin: 0;
      }
      body {
        margin: 0;
        background: #f5f5f4;
        color: #111827;
      }
      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 12mm 10mm 14mm;
        position: relative;
        overflow: hidden;
        background:
          radial-gradient(ellipse 88% 54% at 52% 38%, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.88) 48%, rgba(255, 255, 255, 0) 78%),
          radial-gradient(circle at 83% 10%, rgba(246, 196, 133, 0.22), rgba(246, 196, 133, 0) 32%),
          radial-gradient(circle at 6% 92%, rgba(111, 191, 70, 0.22), rgba(111, 191, 70, 0) 38%),
          linear-gradient(158deg, #fffaf1 0%, #fbf8ef 45%, #edf8e6 78%, #d9efca 100%);
      }
      .page::before {
        content: "";
        position: absolute;
        inset: -20mm -14mm auto auto;
        width: 124mm;
        height: 94mm;
        background: radial-gradient(circle, rgba(242, 170, 98, 0.13), rgba(242, 170, 98, 0) 68%);
        pointer-events: none;
      }
      .page::after {
        content: "";
        position: absolute;
        left: -42mm;
        bottom: -30mm;
        width: 168mm;
        height: 64mm;
        border-radius: 50% 50% 0 0;
        background: linear-gradient(132deg, rgba(111, 191, 70, 0.42), rgba(79, 161, 62, 0.34));
        pointer-events: none;
      }
      .watermark {
        position: absolute;
        top: 48%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 128mm;
        opacity: 0.055;
        z-index: 0;
        pointer-events: none;
      }
      .receipt {
        position: relative;
        z-index: 1;
        min-height: calc(297mm - 26mm);
        display: flex;
        flex-direction: column;
      }
      .header {
        text-align: center;
        padding-top: 1mm;
      }
      .logo {
        display: block;
        width: 86mm;
        max-height: 28mm;
        object-fit: contain;
        margin: 0 auto;
      }
      .clinic-subtitle {
        margin: -1mm 0 0;
        font-size: 14px;
        line-height: 1;
        font-weight: 900;
        letter-spacing: 0.01em;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.75);
      }
      .heartbeat {
        margin: 2mm auto 0;
        width: 110mm;
        height: 18mm;
      }
      .heartbeat path {
        fill: none;
        stroke: rgba(77, 168, 63, 0.58);
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .meta {
        margin-top: 10mm;
        width: 100%;
        display: grid;
        gap: 4mm;
        font-size: 16px;
        font-weight: 800;
      }
      .meta-row {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: end;
        gap: 2mm;
      }
      .label {
        letter-spacing: 0.02em;
      }
      .line {
        min-height: 7mm;
        border-bottom: 1.5px solid #1f2937;
        font-weight: 700;
        padding: 0 2mm 1mm;
      }
      .table-wrap {
        margin-top: 10mm;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        background: rgba(255, 255, 255, 0.32);
      }
      th {
        background: #2c312f;
        color: #ffffff;
        font-size: 20px;
        line-height: 1;
        letter-spacing: 0.10em;
        text-transform: uppercase;
        padding: 7px 10px;
        border: 1.25px solid #4b5563;
      }
      td {
        height: 10mm;
        border: 1.15px solid rgba(31, 41, 55, 0.66);
        padding: 5px 8px;
        font-size: 13px;
        font-weight: 700;
        vertical-align: top;
        background: rgba(255, 255, 255, 0.28);
      }
      .description {
        width: 34%;
      }
      .qty {
        width: 14%;
        text-align: center;
      }
      .price,
      .amount {
        width: 26%;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .totals {
        display: grid;
        grid-template-columns: 1fr 86mm;
        gap: 8mm;
        margin-top: 6mm;
        align-items: start;
      }
      .sale-details {
        color: rgba(17, 24, 39, 0.76);
        font-size: 12px;
        line-height: 1.7;
        font-weight: 700;
      }
      .sale-details p {
        margin: 0;
      }
      .total-row {
        display: grid;
        grid-template-columns: 30mm 1fr;
        align-items: end;
        gap: 4mm;
        margin-bottom: 5mm;
        font-size: 20px;
        font-weight: 900;
      }
      .total-label {
        text-align: right;
      }
      .total-line {
        min-height: 8mm;
        border-bottom: 1.5px solid #1f2937;
        text-align: right;
        padding: 0 2mm 1mm;
        font-variant-numeric: tabular-nums;
      }
      .signatures {
        margin-top: 28mm;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 34mm;
        padding: 0 8mm 2mm;
        position: relative;
        z-index: 1;
      }
      .signature-name {
        min-height: 7mm;
        padding: 0 2mm 2mm;
        text-align: center;
        color: #0f172a;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.03em;
      }
      .signature-line {
        margin-top: 2mm;
        border-top: 2px solid #334155;
        padding-top: 2mm;
        text-align: center;
        color: #334155;
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      @media print {
        body {
          background: transparent;
        }
        .page {
          margin: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <img class="watermark" src="/cprmedlogotansparent.png" alt="" aria-hidden="true" />
      <section class="receipt" aria-label="CPRMed POS receipt">
        <header class="header">
          <img class="logo" src="/cprmedlogotansparent.png" alt="CPRMed Center for Prime Response" />
          <p class="clinic-subtitle">Center for Prime Response</p>
          <svg class="heartbeat" viewBox="0 0 640 100" aria-hidden="true" focusable="false">
            <path d="M18 58 H130 C144 58 148 36 158 36 C171 36 174 82 187 82 C202 82 204 18 218 18 C232 18 235 58 250 58 H322 C337 58 341 36 352 36 C365 36 368 82 381 82 C396 82 399 18 412 18 C426 18 430 58 444 58 H516 C530 58 534 36 545 36 C558 36 561 82 574 82 C589 82 592 18 606 18 C618 18 623 58 632 58" />
          </svg>
        </header>

        <section class="meta">
          <div class="meta-row">
            <span class="label">Date:</span>
            <span class="line">${escapeHtml(toDisplayDate(input.issuedAt))}</span>
          </div>
          <div class="meta-row">
            <span class="label">BILLED TO:</span>
            <span class="line">${escapeHtml(input.customerName || "Walk-in customer")}</span>
          </div>
        </section>

        <section class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="description">Description</th>
                <th class="qty">Qty.</th>
                <th class="price">Price</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>${buildReceiptRows(input.items)}</tbody>
          </table>
        </section>

        <section class="totals">
          <div class="sale-details">
            <p>Sale No.: ${escapeHtml(input.saleNumber)}</p>
            <p>Payment: ${escapeHtml(input.paymentMethod.toUpperCase())}</p>
            <p>Reference: ${escapeHtml(input.paymentReference || "N/A")}</p>
          </div>
          <div>
            <div class="total-row">
              <span class="total-label">Subtotal</span>
              <span class="total-line">${formatCurrency(input.subtotal)}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Total:</span>
              <span class="total-line">${formatCurrency(input.total)}</span>
            </div>
          </div>
        </section>

        <section class="signatures">
          <div>
            <div class="signature-name">${escapeHtml(input.doctorAssignedName || "N/A")}</div>
            <div class="signature-line">Doctor Assigned</div>
          </div>
          <div>
            <div class="signature-name">${escapeHtml(input.receptionistName || "N/A")}</div>
            <div class="signature-line">Receptionist</div>
          </div>
        </section>
      </section>
    </main>
  </body>
</html>`;
}
