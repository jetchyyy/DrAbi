// ---------------------------------------------------------------------------
// Lab Result Report — HTML document for print/PDF
// ---------------------------------------------------------------------------

import type { LabResultEntry } from './lis-types';
import type { LabAccessionRecord } from './lis-types';

interface LabResultReportInput {
  clinicName: string;
  clinicAddress: string;
  clinicContactNumber: string;
  clinicEmail: string;
  clinicLogoUrl?: string;
  patientName: string;
  patientAge?: string;
  patientSex?: string;
  patientAddress?: string;
  accession: LabAccessionRecord | null;
  serviceName: string;
  requestedByName: string;
  completedByName: string;
  requestDate: string;
  completedDate: string;
  tatMinutes?: number | null;
  results: LabResultEntry[];
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatTat(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function flagColor(flag: string): string {
  switch (flag) {
    case 'low': return '#d97706';
    case 'high': return '#ea580c';
    case 'critical': return '#dc2626';
    default: return '#059669';
  }
}

function flagLabel(flag: string): string {
  switch (flag) {
    case 'low': return 'L';
    case 'high': return 'H';
    case 'critical': return 'C';
    default: return '';
  }
}

export function buildLabResultReport(input: LabResultReportInput) {
  const resultsHtml = input.results
    .map((r) => {
      const value = r.valueNumeric != null ? r.valueNumeric.toString() : r.valueText ?? '—';
      const refRange = r.referenceRangeLow != null && r.referenceRangeHigh != null
        ? `${r.referenceRangeLow} – ${r.referenceRangeHigh}`
        : '—';
      const fLabel = flagLabel(r.abnormalFlag);
      const fColor = flagColor(r.abnormalFlag);

      return `
        <tr>
          <td class="param-name">${escapeHtml(r.parameterName ?? '')}</td>
          <td class="value" style="color: ${fColor}; font-weight: ${r.abnormalFlag !== 'normal' ? '800' : '600'}">
            ${escapeHtml(value)}${fLabel ? ` <span class="flag" style="background: ${fColor}">${fLabel}</span>` : ''}
          </td>
          <td class="unit">${escapeHtml(r.unit ?? '')}</td>
          <td class="ref-range">${escapeHtml(refRange)}</td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lab Result - ${escapeHtml(input.patientName)}</title>
    <style>
      :root { color-scheme: light; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4 portrait; margin: 10mm; }
      body { margin: 0; background: #f5f5f4; color: #0f172a; }

      .viewer-actions {
        position: sticky; top: 0; z-index: 10;
        display: flex; justify-content: center; gap: 10px;
        padding: 10px 12px; background: rgba(15, 23, 42, 0.92);
      }
      .viewer-actions button {
        border: 0; border-radius: 999px; padding: 8px 16px;
        font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
        text-transform: uppercase; cursor: pointer;
      }
      .viewer-actions .print { background: #059669; color: #fff; }
      .viewer-actions .pdf { background: #dc2626; color: #fff; }

      .page {
        width: 100%; max-width: 194mm; min-height: calc(297mm - 20mm);
        margin: 20px auto; padding: 0; background: #fff;
        border: 1px solid #d1d5db; display: flex; flex-direction: column;
      }

      .header {
        border-bottom: 3px solid #059669; padding: 16px 20px;
        display: flex; align-items: center; gap: 16px;
      }
      .header-logo { width: 80px; height: 60px; object-fit: contain; }
      .header-center { flex: 1; text-align: center; }
      .header-center h1 { margin: 0; font-size: 28px; font-weight: 900; color: #059669; }
      .header-center p { margin: 2px 0 0; font-size: 11px; color: #475569; }

      .report-title {
        background: #059669; color: #fff; text-align: center;
        padding: 8px; font-size: 14px; font-weight: 800;
        letter-spacing: 0.12em; text-transform: uppercase;
      }

      .patient-info {
        padding: 12px 20px; border-bottom: 1px solid #e2e8f0;
        display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
        font-size: 11px;
      }
      .patient-info .label { font-weight: 700; color: #475569; }
      .patient-info .value { font-weight: 600; color: #0f172a; }

      .accession-bar {
        padding: 8px 20px; background: #f0fdf4; border-bottom: 1px solid #bbf7d0;
        font-size: 10px; display: flex; gap: 20px; font-weight: 600; color: #166534;
      }

      .results-table {
        width: 100%; border-collapse: collapse; font-size: 12px;
        margin: 0; flex: 1;
      }
      .results-table thead th {
        background: #f8fafc; border-bottom: 2px solid #e2e8f0;
        padding: 8px 12px; text-align: left; font-weight: 800;
        font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
        color: #475569;
      }
      .results-table tbody td {
        padding: 8px 12px; border-bottom: 1px solid #f1f5f9;
      }
      .results-table .param-name { font-weight: 600; color: #1e293b; }
      .results-table .value { font-weight: 600; }
      .results-table .unit { font-size: 10px; color: #64748b; }
      .results-table .ref-range { font-size: 10px; color: #94a3b8; }

      .flag {
        display: inline-block; width: 16px; height: 16px; line-height: 16px;
        text-align: center; border-radius: 50%; color: #fff;
        font-size: 9px; font-weight: 900; vertical-align: middle; margin-left: 4px;
      }

      .footer-section {
        padding: 16px 20px; border-top: 2px solid #e2e8f0;
        display: flex; justify-content: space-between; align-items: flex-end;
      }
      .signature-block { text-align: center; min-width: 200px; }
      .signature-line {
        border-top: 1px solid #1e293b; margin-top: 40px; padding-top: 4px;
        font-size: 11px; font-weight: 700;
      }
      .signature-role { font-size: 9px; color: #64748b; }

      .tat-badge {
        display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0;
        border-radius: 8px; padding: 4px 10px; font-size: 10px; font-weight: 700;
        color: #059669;
      }

      .timestamp { font-size: 9px; color: #94a3b8; text-align: center; padding: 6px; }

      @media print {
        .viewer-actions { display: none; }
        body { background: #fff; }
        .page { max-width: none; border: 0; margin: 0; }
      }
    </style>
  </head>
  <body>
    <section class="viewer-actions">
      <button class="print" type="button" onclick="window.print()">Print</button>
      <button class="pdf" type="button" onclick="window.print()">Save as PDF</button>
    </section>

    <main class="page">
      <div class="header">
        ${input.clinicLogoUrl ? `<img class="header-logo" src="${escapeHtml(input.clinicLogoUrl)}" alt="Logo" />` : ''}
        <div class="header-center">
          <h1>${escapeHtml(input.clinicName)}</h1>
          <p>${escapeHtml(input.clinicAddress)}</p>
          <p>${escapeHtml(input.clinicContactNumber)} · ${escapeHtml(input.clinicEmail)}</p>
        </div>
      </div>

      <div class="report-title">Laboratory Result Report</div>

      <div class="patient-info">
        <div><span class="label">Patient:</span> <span class="value">${escapeHtml(input.patientName)}</span></div>
        <div><span class="label">Age/Sex:</span> <span class="value">${escapeHtml(input.patientAge ?? '—')} / ${escapeHtml(input.patientSex ?? '—')}</span></div>
        <div><span class="label">Test:</span> <span class="value">${escapeHtml(input.serviceName)}</span></div>
        <div><span class="label">Date Requested:</span> <span class="value">${escapeHtml(toDisplayDate(input.requestDate))}</span></div>
        <div><span class="label">Requested By:</span> <span class="value">${escapeHtml(input.requestedByName)}</span></div>
        <div><span class="label">Date Completed:</span> <span class="value">${escapeHtml(toDisplayDate(input.completedDate))}</span></div>
      </div>

      ${input.accession ? `
      <div class="accession-bar">
        <span>Accession No: ${escapeHtml(input.accession.accessionNumber)}</span>
        <span>Specimen: ${escapeHtml(input.accession.specimenType)}</span>
        <span>Condition: ${escapeHtml(input.accession.specimenCondition)}</span>
        ${input.tatMinutes ? `<span>TAT: <span class="tat-badge">${formatTat(input.tatMinutes)}</span></span>` : ''}
      </div>` : ''}

      <table class="results-table">
        <thead>
          <tr>
            <th style="width:35%">Parameter</th>
            <th style="width:25%">Result</th>
            <th style="width:15%">Unit</th>
            <th style="width:25%">Reference Range</th>
          </tr>
        </thead>
        <tbody>
          ${resultsHtml || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8">No structured results recorded</td></tr>'}
        </tbody>
      </table>

      <div class="footer-section">
        <div>
          <p style="font-size:9px;color:#94a3b8;margin:0">This result is electronically generated.</p>
        </div>
        <div class="signature-block">
          <div class="signature-line">${escapeHtml(input.completedByName || 'Lab Staff')}</div>
          <div class="signature-role">Medical Technologist</div>
        </div>
      </div>

      <div class="timestamp">
        Generated: ${toDisplayDate(new Date().toISOString())}
      </div>
    </main>
  </body>
</html>`;
}
