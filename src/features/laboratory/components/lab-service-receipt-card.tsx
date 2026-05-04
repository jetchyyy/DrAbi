import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';

import { Button } from '../../../components/ui/button';
import { Card, CardTitle } from '../../../components/ui/card';
import { printHtmlDocument } from '../../../lib/print';
import { formatCurrency } from '../../../lib/utils';
import type { Invoice } from '../../../types/domain';
import type { LabRequestRecord } from '../../lab-requests/types';
import { buildLabServiceReceiptLookupUrl } from '../lab-service-receipt';

interface LabServiceReceiptCardProps {
  invoice: Invoice;
  patientName: string;
  request: LabRequestRecord;
}

function buildPrintDocument(input: {
  qrSvgMarkup: string;
  invoice: Invoice;
  patientName: string;
  request: LabRequestRecord;
}) {
  const receiptDate = new Date(input.invoice.createdAt);
  const serviceLabel = input.request.serviceName ?? input.request.serviceCategory;
  const paymentStatusLabel = input.invoice.paymentStatus.toUpperCase();
  const laboratoryReceiptCode = input.request.receiptCode ?? input.invoice.invoiceNumber;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lab Service Receipt ${input.invoice.invoiceNumber}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 28px;
        background: #f8fafc;
        color: #1f2937;
      }
      .sheet {
        max-width: 760px;
        margin: 0 auto;
        background: #ffffff;
        padding: 30px 44px 34px;
      }
      .clinic-name {
        margin: 0;
        color: #2563eb;
        font-size: 20px;
        font-weight: 700;
        text-align: center;
      }
      h1 {
        margin: 8px 0 0;
        font-size: 17px;
        font-weight: 800;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.01em;
      }
      p {
        margin: 0;
        line-height: 1.5;
      }
      .divider {
        margin: 22px 0 30px;
        border: 0;
        border-top: 2px solid #374151;
      }
      .meta {
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr);
        row-gap: 8px;
        column-gap: 16px;
        align-items: start;
      }
      .meta-label {
        font-size: 14px;
        font-weight: 700;
        color: #374151;
      }
      .meta-value {
        font-size: 14px;
        color: #111827;
        text-align: right;
        word-break: break-word;
      }
      .code {
        font-family: "Courier New", monospace;
      }
      .status-paid {
        color: #059669;
        font-weight: 800;
      }
      .section-title {
        margin-top: 30px;
        font-size: 15px;
        font-weight: 700;
        color: #1f2937;
      }
      .section-rule {
        margin: 10px 0 14px;
        border: 0;
        border-top: 1px solid #d1d5db;
      }
      .service-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        font-size: 14px;
        color: #111827;
        align-items: center;
        padding-right: 2px;
      }
      .service-amount {
        font-weight: 800;
      }
      .total-box {
        margin-top: 26px;
        border-left: 4px solid #2563eb;
        padding: 11px 14px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        align-items: center;
        background: #ffffff;
      }
      .total-label {
        font-size: 16px;
        font-weight: 800;
        color: #1f2937;
      }
      .total-value {
        font-size: 16px;
        font-weight: 800;
        color: #059669;
      }
      .qr-panel {
        margin-top: 26px;
        border: 1px dashed #d1d5db;
        border-radius: 10px;
        padding: 18px 18px 14px;
        text-align: center;
      }
      .qr-title {
        font-size: 14px;
        font-weight: 700;
        color: #1f2937;
      }
      .qr-wrap {
        margin-top: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 158px;
      }
      .qr-wrap svg {
        width: 150px;
        height: 150px;
      }
      .qr-note {
        margin-top: 10px;
        font-size: 11px;
        color: #6b7280;
      }
      .instructions {
        margin-top: 22px;
        border-left: 4px solid #f59e0b;
        padding-left: 12px;
      }
      .instructions-title {
        font-size: 14px;
        font-weight: 800;
        color: #1f2937;
      }
      .instructions ul {
        margin: 10px 0 0 18px;
        padding: 0;
        color: #1f2937;
        font-size: 14px;
      }
      .instructions li + li {
        margin-top: 6px;
      }
      @media print {
        body {
          background: #ffffff;
          padding: 0;
        }
        .sheet {
          border: none;
          border-radius: 0;
          max-width: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <p class="clinic-name">Odyssey Clinic</p>
      <h1>Service Payment Receipt</h1>

      <hr class="divider" />

      <section class="meta">
        <p class="meta-label">Patient:</p>
        <p class="meta-value">${input.patientName}</p>

        <p class="meta-label">Patient ID:</p>
        <p class="meta-value code">${input.request.patientId}</p>

        <p class="meta-label">Date:</p>
        <p class="meta-value">${receiptDate.toLocaleDateString('en-PH')}</p>

        <p class="meta-label">Time:</p>
        <p class="meta-value">${receiptDate.toLocaleTimeString('en-PH')}</p>

        <p class="meta-label">Status:</p>
        <p class="meta-value status-paid">${paymentStatusLabel}</p>

        <p class="meta-label">Invoice No.:</p>
        <p class="meta-value code">${input.invoice.invoiceNumber}</p>

        <p class="meta-label">Receipt code:</p>
        <p class="meta-value code">${laboratoryReceiptCode}</p>
      </section>

      <section>
        <p class="section-title">Services Paid:</p>
        <hr class="section-rule" />
        <div class="service-row">
          <p>${serviceLabel}</p>
          <p class="service-amount">${formatCurrency(input.invoice.total)}</p>
        </div>
      </section>

      <section class="total-box">
        <p class="total-label">Total Amount:</p>
        <p class="total-value">${formatCurrency(input.invoice.total)}</p>
      </section>

      <section class="qr-panel">
        <p class="qr-title">Payment Verification QR Code</p>
        <div class="qr-wrap">${input.qrSvgMarkup}</div>
        <p class="qr-note">Present this QR code at the laboratory/service area</p>
      </section>

      <section class="instructions">
        <p class="instructions-title">Important Instructions:</p>
        <ul>
          <li>Present this receipt at the laboratory/service area before receiving services.</li>
          <li>Keep this receipt for your records.</li>
          <li>Allow staff to scan the QR code so they can proceed with the linked laboratory request.</li>
        </ul>
      </section>
    </main>
  </body>
</html>`;
}

export function LabServiceReceiptCard({
  invoice,
  patientName,
  request,
}: LabServiceReceiptCardProps) {
  const [svgMarkup, setSvgMarkup] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    let active = true;

    void QRCode.toString(buildLabServiceReceiptLookupUrl(request.id), {
      errorCorrectionLevel: 'M',
      margin: 1,
      type: 'svg',
      width: 220,
    }).then((svg) => {
      if (active) {
        setSvgMarkup(svg);
      }
    });

    return () => {
      active = false;
    };
  }, [request.id]);

  const handlePrint = async () => {
    if (!svgMarkup) {
      toast.error('The receipt QR is still being generated. Please try again in a moment.');
      return;
    }

    setIsPrinting(true);
    try {
      await printHtmlDocument(
        buildPrintDocument({
          qrSvgMarkup: svgMarkup,
          invoice,
          patientName,
          request,
        }),
      );
    } catch {
      toast.error('The receipt could not be sent to the print dialog.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Card className="h-full">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
        Lab Receipt
      </p>
      <CardTitle className="mt-2">Paid and ready for laboratory intake</CardTitle>
      <p className="mt-2 text-sm text-slate-500">
        Staff can scan this QR to load the paid laboratory request and continue the lab test workflow.
      </p>

      <div className="mt-5 flex justify-center rounded-[28px] bg-slate-50 p-5">
        {svgMarkup ? (
          <div
            aria-label={`Receipt QR for ${request.serviceName ?? request.serviceCategory}`}
            className="size-[220px]"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <div className="flex size-[220px] items-center justify-center rounded-3xl bg-white text-sm text-slate-400">
            Generating QR...
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Patient</p>
          <p className="mt-1 font-semibold text-slate-950">{patientName}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Service</p>
          <p className="mt-1 font-semibold text-slate-950">{request.serviceName ?? request.serviceCategory}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Invoice</p>
          <p className="mt-1 break-all font-mono font-semibold text-slate-950">{invoice.invoiceNumber}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Amount paid</p>
          <p className="mt-1 font-semibold text-slate-950">{formatCurrency(invoice.total)}</p>
        </div>
      </div>

      <Button
        className="mt-4 w-full gap-2 rounded-none bg-violet-700 font-extrabold uppercase tracking-widest hover:bg-violet-800"
        disabled={!svgMarkup || isPrinting}
        onClick={() => void handlePrint()}
        type="button"
      >
        <Printer className="size-4" />
        {isPrinting ? 'Opening print preview...' : 'Print receipt'}
      </Button>
    </Card>
  );
}
