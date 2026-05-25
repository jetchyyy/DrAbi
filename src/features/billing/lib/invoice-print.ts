import { formatCurrency } from '../../../lib/utils';
import type { Invoice } from '../../../types/domain';

export function buildInvoicePrintDocument(input: {
  clinicName: string;
  invoice: Invoice;
  patientName: string;
  patientContact: string;
  items: Array<{
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
  }>;
  qrSvgMarkup?: string;
  qrHelperText?: string;
}) {
  const createdAt = new Date(input.invoice.createdAt);
  const paymentStatusLabel = input.invoice.paymentStatus.toUpperCase();

  // Build up to 6 item rows; pad with empty rows so the table always looks full
  const MIN_ROWS = 6;
  const items = input.items.slice();
  while (items.length < MIN_ROWS) {
    items.push({ description: '', category: '', quantity: 0, unitPrice: 0 });
  }

  const itemRows = items
    .map((item, i) => {
      const amount = item.quantity && item.unitPrice ? item.quantity * item.unitPrice : 0;
      return `
        <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="td-desc">${item.description ? item.description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</td>
          <td class="td-center">${item.quantity || ''}</td>
          <td class="td-right">${item.unitPrice ? formatCurrency(item.unitPrice) : ''}</td>
          <td class="td-right td-amount">${amount ? formatCurrency(amount) : ''}</td>
        </tr>`;
    })
    .join('');

  const statusClass =
    input.invoice.paymentStatus === 'paid'
      ? 'status-paid'
      : input.invoice.paymentStatus === 'partial'
        ? 'status-partial'
        : 'status-unpaid';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Medika Billing Invoice – ${input.invoice.invoiceNumber}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #f0f0f0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      padding: 24px;
    }

    /* ── Page sheet ── */
    .sheet {
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
      padding: 0 0 36px;
      position: relative;
      overflow: hidden;
    }

    /* ── Green wave footer strip ── */
    .sheet::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 58px;
      background: #4caf50;
      border-radius: 80% 80% 0 0 / 40px 40px 0 0;
      z-index: 0;
    }

    /* ── Header band ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 28px 10px;
      border-bottom: 2px solid #e8e8e8;
    }

    .logo-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Play-button hex icon */
    .logo-icon {
      width: 36px;
      height: 36px;
      background: #222;
      clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .logo-icon::after {
      content: '';
      display: block;
      width: 0;
      height: 0;
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      border-left: 13px solid #fff;
      margin-left: 3px;
    }

    .brand-text {
      line-height: 1;
    }
    .brand-name {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .brand-cpr { color: #4caf50; }
    .brand-med { color: #2196f3; }
    .brand-tagline {
      font-size: 10px;
      color: #555;
      letter-spacing: 0.04em;
      margin-top: 2px;
    }

    /* ECG pulse line */
    .ecg-wrap {
      flex: 1;
      margin: 0 18px;
      overflow: hidden;
      height: 36px;
      display: flex;
      align-items: center;
    }
    .ecg-wrap svg { width: 100%; height: 36px; }

    .header-right {
      text-align: right;
      min-width: 110px;
    }
    .invoice-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #777;
    }
    .invoice-number {
      font-size: 13px;
      font-weight: 800;
      color: #111;
      font-family: 'Courier New', monospace;
    }

    /* ── Meta row (Date / Billed To / Status) ── */
    .meta-band {
      padding: 12px 28px;
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px 24px;
      background: #fafafa;
      border-bottom: 1px solid #e8e8e8;
      font-size: 12px;
    }
    .meta-label {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      font-size: 10px;
    }
    .meta-value {
      font-weight: 700;
      color: #111;
      font-size: 13px;
      margin-top: 2px;
      border-bottom: 1.5px solid #aaa;
      padding-bottom: 2px;
      min-width: 120px;
    }
    .meta-value.patient-name {
      min-width: 240px;
    }

    /* Status badge */
    .status-paid   { color: #fff; background: #4caf50; }
    .status-unpaid { color: #fff; background: #f44336; }
    .status-partial{ color: #fff; background: #ff9800; }
    .status-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 3px;
      margin-top: 4px;
    }

    /* ── Invoice table ── */
    .table-wrap {
      padding: 0 28px;
      margin-top: 16px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead tr {
      background: #2c2c2c;
      color: #fff;
    }
    thead th {
      padding: 9px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    thead th:first-child  { text-align: left;   width: 44%; }
    thead th:nth-child(2) { text-align: center; width: 14%; }
    thead th:nth-child(3) { text-align: right;  width: 20%; }
    thead th:nth-child(4) { text-align: right;  width: 22%; }

    tbody tr { border-bottom: 1px solid #d9e4f5; }
    .row-even { background: #fff; }
    .row-odd  { background: #f7f9fd; }

    .td-desc   { padding: 9px 10px; font-size: 12.5px; min-height: 32px; }
    .td-center { text-align: center; padding: 9px 6px; font-size: 12.5px; }
    .td-right  { text-align: right;  padding: 9px 10px; font-size: 12.5px; }
    .td-amount { font-weight: 700; }

    /* ── Totals ── */
    .totals-wrap {
      padding: 10px 28px 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 5px;
    }
    .total-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 32px;
      width: 280px;
    }
    .total-row + .total-row {
      border-top: 1.5px solid #111;
      padding-top: 5px;
    }
    .total-label {
      font-size: 13px;
      font-weight: 700;
      color: #444;
      min-width: 80px;
    }
    .total-label.grand { font-size: 14px; color: #111; }
    .total-value {
      font-size: 13px;
      font-weight: 800;
      color: #111;
      text-align: right;
      min-width: 100px;
    }
    .total-value.grand { font-size: 15px; }

    /* ── QR block ── */
    .qr-section {
      margin: 14px 28px 0;
      border: 1px dashed #b0b0b0;
      padding: 12px 16px 10px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .qr-section svg { width: 90px; height: 90px; flex-shrink: 0; }
    .qr-text {
      font-size: 11px;
      color: #555;
      line-height: 1.5;
    }
    .qr-text strong { color: #111; }

    /* ── Signature grid ── */
    .sig-grid {
      position: relative;
      z-index: 1;
      margin: 20px 28px 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 40px;
    }
    .sig-block { text-align: center; }
    .sig-line {
      border-top: 1.5px solid #fff;
      margin-bottom: 5px;
    }
    .sig-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #fff;
    }

    /* ── Footnote ── */
    .footnote {
      margin: 14px 28px 0;
      font-size: 10px;
      color: #888;
      text-align: center;
    }

    @media print {
      body { background: #fff; padding: 0; }
      .sheet { max-width: none; }
    }
  </style>
</head>
<body>
<main class="sheet">

  <!-- ═══ HEADER ═══ -->
  <header class="header">
    <div class="logo-wrap">
      <div class="logo-icon"></div>
      <div class="brand-text">
        <div class="brand-name">
          <span class="brand-cpr">CPR</span><span class="brand-med">Med</span>
        </div>
        <div class="brand-tagline">Center for Prime Response</div>
      </div>
    </div>

    <!-- ECG pulse SVG -->
    <div class="ecg-wrap">
      <svg viewBox="0 0 260 36" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <polyline
          points="0,18 30,18 40,18 45,6 50,30 55,4 60,32 65,18 80,18 110,18 120,18 125,8 130,28 135,4 140,30 145,18 160,18 190,18 200,18 205,8 210,28 215,4 220,30 225,18 260,18"
          fill="none"
          stroke="#4caf50"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <div class="header-right">
      <div class="invoice-label">Billing Invoice</div>
      <div class="invoice-number">${input.invoice.invoiceNumber}</div>
    </div>
  </header>

  <!-- ═══ META BAND ═══ -->
  <div class="meta-band">
    <div>
      <div class="meta-label">Date</div>
      <div class="meta-value">${createdAt.toLocaleDateString('en-PH')}</div>
    </div>
    <div>
      <div class="meta-label">Billed To</div>
      <div class="meta-value patient-name">${input.patientName}</div>
    </div>
    <div>
      <div class="meta-label">Status</div>
      <span class="status-badge ${statusClass}">${paymentStatusLabel}</span>
    </div>
  </div>

  <!-- ═══ ITEMS TABLE ═══ -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty.</th>
          <th>Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  </div>

  <!-- ═══ TOTALS ═══ -->
  <div class="totals-wrap">
    <div class="total-row">
      <span class="total-label">Subtotal</span>
      <span class="total-value">${formatCurrency(input.invoice.subtotal)}</span>
    </div>
    <div class="total-row">
      <span class="total-label grand">Total:</span>
      <span class="total-value grand">${formatCurrency(input.invoice.total)}</span>
    </div>
  </div>

  ${
    input.qrSvgMarkup
      ? `<!-- ═══ QR ═══ -->
  <div class="qr-section">
    ${input.qrSvgMarkup}
    <div class="qr-text">
      <strong>Payment Verification QR Code</strong><br/>
      ${input.qrHelperText ?? 'Present this QR code to clinic staff for verification.'}
    </div>
  </div>`
      : ''
  }

  <p class="footnote">
    This invoice is generated from the Medika system and reflects the billing summary and payment status saved in the clinic database
  </p>

  <!-- ═══ SIGNATURE STRIP (sits on green wave) ═══ -->
  <div class="sig-grid">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Doctor Assigned</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Receptionist</div>
    </div>
  </div>

</main>
</body>
</html>`;
}