interface MedicationItem {
  name: string;
  brandName?: string;
  dosage: string;
  instruction: string;
  numberOfMedications?: string;
}

interface PrescriptionPrintDocumentInput {
  clinicName: string;
  clinicAddress: string;
  clinicContactNumber: string;
  clinicEmail: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorLicenseNumber: string;
  doctorBirNumber: string;
  doctorPtrNumber: string;
  doctorPrcQrData: string;
  patientName: string;
  patientAge?: string;
  patientSex?: string;
  patientAddress?: string;
  patientWeight?: string;
  patientCivilStatus?: string;
  issuedDate: string;
  medications: MedicationItem[];
  nextAppointment: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

const MEDS_PER_PAGE = 5;

export function buildPrescriptionPrintDocument(input: PrescriptionPrintDocumentInput) {
  const meds = input.medications ?? [];

  // Chunk medications into pages of 5
  const chunks: MedicationItem[][] = [];
  for (let i = 0; i < meds.length; i += MEDS_PER_PAGE) {
    chunks.push(meds.slice(i, i + MEDS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  const headerHtml = `
      <section class="header">
        <div class="header-logo-col">
          <img class="logo" src="/cprmedlogotansparent.png" alt="Clinic logo" />
        </div>
        <div class="header-center-col clinic-center">
          <h1 class="name"><span class="name-cpr">CPR</span><span class="name-med">MED</span></h1>
          <p class="subtitle">CPR Medical Clinic &amp; Laboratory</p>
          <p class="address">${escapeHtml(input.clinicAddress || 'Clinic address')}</p>
          <p class="contact">${escapeHtml(input.clinicContactNumber || 'Not provided')}</p>
          <p class="specialties-bar">General Surgery, Internal Medicine, OB-Gyne, Pediatrics, Family Medicine, Aesthetic Medicine, Addiction Medicine, Anesthesiologist, Cardiologist, Ophthalmologist, ENT, Diabetologist, Nephrologist.</p>
        </div>
        <div class="header-hours-col hours">
          <p class="label">Clinic Hours:</p>
          <p class="schedule">Monday-Sunday:<br/>10:00 AM - 10:00 PM</p>
        </div>
      </section>`;

  const patientLinesHtml = `
      <section class="patient-lines">
        <div class="line-row">
          <span class="line-label">Patient's Name:</span>
          <span class="line-value">${escapeHtml(input.patientName)}</span>
          <span class="line-label">Age:</span>
          <span class="line-value sm">${escapeHtml(input.patientAge || '')}</span>
          <span class="line-label">Sex:</span>
          <span class="line-value sm">${escapeHtml(input.patientSex || '')}</span>
          <span class="line-label">Date:</span>
          <span class="line-value date">${escapeHtml(toDisplayDate(input.issuedDate))}</span>
        </div>
        <div class="line-row">
          <span class="line-label">Address:</span>
          <span class="line-value">${escapeHtml(input.patientAddress || '')}</span>
        </div>
      </section>`;

  const signatureHtml = `
        <aside class="signature-panel">
          <div class="signature-row doctor-name-row">
            <span class="line doctor-name-line">${escapeHtml(input.doctorName || ' ')}</span>
            <span class="label doctor-name-label">Doctor's Name and Signature</span>
          </div>
          <div class="signature-row">
            <span class="label">License no.</span>
            <span class="line">${escapeHtml(input.doctorLicenseNumber || ' ')}</span>
          </div>
          <div class="signature-row">
            <span class="label">PTR no.</span>
            <span class="line">${escapeHtml(input.doctorPtrNumber || ' ')}</span>
          </div>
          <div class="signature-row">
            <span class="label">Tin no.</span>
            <span class="line">${escapeHtml(input.doctorBirNumber || ' ')}</span>
          </div>
          <div class="signature-row">
            <span class="label">S2 no.</span>
            <span class="line"></span>
          </div>
          <p class="debug-note">${escapeHtml(input.doctorSpecialty || 'Physician')}</p>
        </aside>`;

  const pagesHtml = chunks.map((chunk, pageIndex) => {
    const isLastPage = pageIndex === chunks.length - 1;
    const globalStart = pageIndex * MEDS_PER_PAGE;

    const medsHtml = chunk.map((med, i) => `
        <div class="medication-item">
          <div class="medication-main">
            <p><strong>${globalStart + i + 1}. Generic:</strong> ${escapeHtml(med.name)}</p>
            ${med.brandName?.trim() ? `<p><strong>Brand:</strong> ${escapeHtml(med.brandName.trim())}</p>` : ''}
            <p><strong>Dosage:</strong> ${escapeHtml(med.dosage)}</p>
            <p><strong>Sig:</strong> ${escapeHtml(med.instruction)}</p>
          </div>
          <span class="medication-qty">${med.numberOfMedications?.trim() ? `#${escapeHtml(med.numberOfMedications.trim())}` : ''}</span>
        </div>`).join('');

    const footerHtml = isLastPage
      ? `<div class="signature-container">${signatureHtml}</div>`
      : `<p class="continued-note">— continued on next page —</p>
        <div class="signature-container">${signatureHtml}</div>`;

    return `
    <main class="page">
      ${headerHtml}
      ${patientLinesHtml}
      <section class="prescription-area">
        <p class="rx-mark">Rx</p>
        <div class="meds-list">${medsHtml}</div>
        <div class="prescription-footer">${footerHtml}</div>
      </section>
    </main>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Prescription</title>
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
        margin: 8mm;
      }

      body {
        margin: 0;
        background: #f5f5f4;
        color: #0f172a;
      }

      .viewer-actions {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        justify-content: center;
        gap: 10px;
        padding: 10px 12px;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(2px);
      }

      .viewer-actions button {
        border: 0;
        border-radius: 999px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .viewer-actions .print {
        background: #111827;
        color: #ffffff;
      }

      .viewer-actions .pdf {
        background: #dc2626;
        color: #ffffff;
      }

      .viewer-note {
        margin: 0;
        text-align: center;
        padding: 6px 10px 0;
        font-size: 11px;
        color: #475569;
      }

      /* ── Page ── */
      .page {
        width: 100%;
        max-width: 194mm;
        min-height: calc(297mm - 16mm);
        margin: 0 auto;
        padding: 0;
        background: #ffffff;
        border: 1px solid #d1d5db;
        display: flex;
        flex-direction: column;
      }

      .page + .page {
        margin-top: 20px;
      }

      /* ── Header ── */
      .header {
        border-bottom: 2px solid #111827;
        padding: 10px 14px 10px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .header-logo-col {
        flex: 0 0 auto;
        display: flex;
        align-items: flex-start;
        width: 128px;
      }

      .logo {
        width: 128px;
        height: 96px;
        object-fit: contain;
        border: none;
        display: block;
      }

      .specialties-bar {
        margin: 3px 0 0;
        font-size: 7.5px;
        font-weight: 600;
        color: #1e293b;
        white-space: normal;
        text-align: center;
        line-height: 1.4;
      }

      .header-center-col {
        flex: 1;
        text-align: center;
        padding-top: 4px;
      }

      .clinic-center .name {
        margin: 0;
        font-size: 48px;
        line-height: 0.95;
        font-weight: 900;
        letter-spacing: 0.01em;
      }

      .name-cpr {
        color: #6dbf40;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .name-med {
        color: #1a7fd4;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .clinic-center .subtitle {
        margin: 4px 0 0;
        font-size: 14px;
        font-weight: 700;
        color: #111827;
      }

      .clinic-center .address {
        margin: 3px 0 0;
        font-size: 12px;
        color: #0f766e;
        font-weight: 600;
      }

      .clinic-center .contact {
        margin: 2px 0 0;
        font-size: 12px;
        color: #111827;
      }

      .header-hours-col {
        flex: 0 0 auto;
        width: 188px;
        text-align: left;
        padding-top: 28px;
      }

      .hours .label {
        margin: 0;
        font-size: 26px;
        line-height: 1;
        font-weight: 700;
        color: #111827;
      }

      .hours .schedule {
        margin: 4px 0 0;
        font-size: 13px;
        font-weight: 600;
        color: #111827;
      }

      /* ── Patient info ── */
      .patient-lines {
        border-bottom: 1px solid #111827;
        padding: 7px 10px 8px;
      }

      .line-row {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        font-weight: 700;
      }

      .line-row + .line-row {
        margin-top: 6px;
      }

      .line-label {
        white-space: nowrap;
      }

      .line-value {
        flex: 1;
        min-height: 16px;
        border-bottom: 1px solid #374151;
        font-weight: 600;
        font-size: 13px;
        padding: 0 2px;
      }

      .line-value.sm {
        flex: 0 0 64px;
      }

      .line-value.md {
        flex: 0 0 100px;
      }

      .line-value.date {
        flex: 0 0 110px;
      }

      /* ── Prescription area ── */
      .prescription-area {
        flex: 1;
        padding: 16px 14px 16px;
        display: flex;
        flex-direction: column;
        position: relative;
      }

      .rx-mark {
        margin: 0;
        font-family: "Times New Roman", Georgia, serif;
        font-size: 70px;
        line-height: 1;
        font-style: italic;
        font-weight: 700;
      }

      .meds-list {
        flex: 1;
      }

      .medication-item {
        margin-top: 6px;
        width: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .medication-item + .medication-item {
        margin-top: 6px;
      }

      .medication-main {
        max-width: 76%;
      }

      .medication-item p {
        margin: 0;
        font-size: 16px;
        line-height: 1.45;
      }

      .medication-item p + p {
        margin-top: 1px;
      }

      .medication-qty {
        flex-shrink: 0;
        font-weight: 700;
        text-align: right;
        min-width: 56px;
        margin-right: 2px;
      }

      /* ── Footer (follow-up + signature or continued note) ── */
      .prescription-footer {
        margin-top: 12px;
      }

      .follow-up {
        margin: 0 0 16px;
        font-size: 13px;
        color: #1f2937;
        font-style: italic;
      }

      .continued-note {
        margin: 0;
        font-size: 11px;
        font-style: italic;
        color: #64748b;
        text-align: center;
        padding: 6px 0;
        border-top: 1px dashed #d1d5db;
      }

      .signature-container {
        display: flex;
        justify-content: flex-end;
      }


      .signature-panel {
        width: 360px;
        max-width: 100%;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }




      .signature-row {
        display: flex;
        align-items: center;
        gap: 0px;
        min-height: 18px;
        justify-content: flex-end;
      }




      .signature-row .label {
        width: 90px;
        font-weight: 700;
        font-size: 12px;
        margin-bottom: 0;
        padding-bottom: 0;
        line-height: 1.1;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 6px;
      }




      .signature-row .line {
        flex: 0 0 188px;
        width: 188px;
        max-width: 188px;
        border-bottom: 1px solid #111827;
        min-height: 14px;
        padding: 0 2px 0 2px;
        font-weight: 600;
        font-size: 12px;
        margin-bottom: 0;
        line-height: 1.1;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
      }

      .signature-row .line.upper {
        text-transform: uppercase;
      }


      .doctor-name-row {
        display: block;
        min-height: auto;
        padding-left: 158px;
        margin-bottom: 0px;
      }

      .signature-row .doctor-name-label {
        display: block;
        width: 100%;
        margin-top: 0px;
        margin-bottom: 2px;
        font-size: 11px;
        font-weight: 700;
        text-align: center;
        white-space: nowrap;
        line-height: 1.1;
      }


      .doctor-name-line {
        display: block;
        width: 320px;
        max-width: 320px;
        min-height: 16px;
        white-space: nowrap;
        text-align: center;
        letter-spacing: 0.01em;
        border-bottom: 1px solid #111827;
        margin-left: auto;
        margin-right: auto;
        padding: 0 2px;
      }


      .signature-row + .signature-row {
        margin-top: 2px;
      }

      .debug-note {
        margin-top: 4px;
        font-size: 9px;
        color: #64748b;
      }

      @media print {
        .viewer-actions,
        .viewer-note {
          display: none;
        }

        body {
          background: #ffffff;
        }

        .page {
          max-width: none;
          border: 0;
          padding: 0;
        }

        .page + .page {
          margin-top: 0;
          page-break-before: always;
        }
      }
    </style>
  </head>
  <body>
    <section class="viewer-actions">
      <button class="print" type="button" onclick="window.print()">Print</button>
      <button class="pdf" type="button" onclick="window.print()">Save as PDF</button>
    </section>
    <p class="viewer-note">Tip: click Save as PDF then choose <strong>Save as PDF</strong> in your browser print destination.</p>

    ${pagesHtml}
  </body>
</html>`;
}
