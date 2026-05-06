interface MedicalCertificatePrintDocumentInput {
  certificateNumber: string;
  patientQrSvg?: string;
  patientQrCode?: string;
  patientReferenceCode?: string;
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
  patientAge: string;
  patientSex: string;
  patientAddress: string;
  issuedDate: string;
  certificatePurpose: string;
  diagnosis: string;
  recommendation: string;
  restFrom: string;
  restUntil: string;
  checkFinancial: boolean;
  checkSchool: boolean;
  checkWork: boolean;
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
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function buildMedicalCertificatePrintDocument(input: MedicalCertificatePrintDocumentInput) {
  const checkFinancial = input.checkFinancial;
  const checkSchool = input.checkSchool;
  const checkWork = input.checkWork;

  const dateObj = new Date(input.issuedDate);
  const isValidDate = !Number.isNaN(dateObj.getTime());
  const dayStr = isValidDate ? String(dateObj.getDate()).padStart(2, '0') : '____';
  const monthStr = isValidDate ? new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(dateObj) : '____________';
  const yearStr = isValidDate ? String(dateObj.getFullYear()) : '____';

  const restNote = input.restFrom && input.restUntil
    ? ` Patient is advised to rest from ${toDisplayDate(input.restFrom)} to ${toDisplayDate(input.restUntil)}.`
    : input.restFrom
      ? ` Patient is advised to rest starting ${toDisplayDate(input.restFrom)}.`
      : input.restUntil
        ? ` Patient is advised to rest until ${toDisplayDate(input.restUntil)}.`
        : '';

  const healthRecordNumber = input.patientQrCode?.trim() || 'ODC-PAT';
  const patientQrLabel = input.patientQrCode?.trim() || input.patientReferenceCode?.trim() || '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Medical Certificate</title>
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
      .viewer-actions .print { background: #111827; color: #ffffff; }
      .viewer-actions .pdf { background: #dc2626; color: #ffffff; }
      .viewer-note {
        margin: 0;
        text-align: center;
        padding: 6px 10px 0;
        font-size: 11px;
        color: #475569;
      }

      /* ── Page ── */
      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 8mm 10mm 10mm;
        background:
          radial-gradient(
            ellipse 110% 62% at 50% 54%,
            #ffffff    0%,
            #ffffff    38%,
            rgba(255, 255, 255, 0.92) 52%,
            rgba(255, 255, 255, 0.60) 65%,
            rgba(255, 255, 255, 0)    80%
          ),
          #b8e0a0;
        border: none;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .watermark {
        position: absolute;
        top: 56%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 580px;
        height: 290px;
        opacity: 0.13;
        pointer-events: none;
        z-index: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .watermark img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      /* Ensure all direct page content renders above watermark */
      .header, .document-title, .cert-body, .patient-qr-section, .signature-section {
        position: relative;
        z-index: 1;
      }

      /* ── Header ── */
      .header {
        border-bottom: 2px solid #111827;
        padding: 4px 0 8px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .header-logo-col {
        flex: 0 0 auto;
        width: 128px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }
      .logo {
        width: 128px;
        height: 96px;
        object-fit: contain;
        border: none;
        display: block;
      }
      .header-center-col {
        flex: 1;
        text-align: center;
        padding-top: 4px;
      }
      .clinic-name {
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
      .clinic-subtitle {
        margin: 4px 0 0;
        font-size: 14px;
        font-weight: 700;
        color: #111827;
      }
      .clinic-address {
        margin: 3px 0 0;
        font-size: 12px;
        color: #0f766e;
        font-weight: 600;
      }
      .clinic-contact {
        margin: 2px 0 0;
        font-size: 12px;
        color: #111827;
      }
      /* Clinic hours + cert meta — right column */
      .header-hours-col {
        flex: 0 0 auto;
        width: 188px;
        text-align: left;
        padding-top: 28px;
        display: flex;
        flex-direction: column;
        gap: 8px;
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
      .cert-meta-block {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-top: 4px;
      }
      .cert-meta-row {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        font-size: 10px;
      }
      .cert-meta-row .ml {
        white-space: nowrap;
        font-weight: 700;
      }
      .cert-meta-row .ml-line {
        flex: 1;
        font-size: 10px;
        padding: 0 2px;
      }
      .cert-meta-row.patient-code-row {
        flex-wrap: nowrap;
      }
      .cert-meta-row.patient-code-row .ml-line {
        white-space: nowrap;
        word-break: keep-all;
        overflow-wrap: normal;
        font-size: 9px;
        letter-spacing: 0.02em;
      }

      /* Specialties bar — center col, below contact */
      .specialties-bar {
        margin: 4px 0 0;
        font-size: 7.5px;
        font-weight: 600;
        color: #1e293b;
        text-align: center;
        line-height: 1.5;
      }

      /* ── Document Title ── */
      .document-title {
        margin: 12px 0 10px;
        text-align: center;
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #111827;
      }

      /* ── Certificate Body ── */
      .cert-body {
        flex: 1;
        padding: 0 0 170px;
        font-size: 16px;
        line-height: 1.9;
        color: #111827;
      }
      .cert-body p { margin: 0; }

      .intro {
        margin-bottom: 8px;
        font-style: italic;
      }

      /* Inline fill rows */
      .fill-para {
        margin-top: 0;
        line-height: 1.9;
      }
      .fill-inline {
        display: inline;
        font-weight: 600;
        padding: 0 2px;
      }
      .fill-inline.sm  { }
      .fill-inline.md  { }
      .fill-inline.lg  { }
      .fill-inline.xl  { }
      .fill-inline.xxl { }

      /* Diagnosis blank lines */
      .blank-area {
        margin-top: 4px;
      }
      .blank-line {
        font-size: 16px;
        font-weight: 600;
        color: #111827;
        line-height: 1.6;
        display: inline;
      }

      /* Recommendation section */
      .rec-section {
        margin-top: 14px;
      }
      .rec-section .sec-title {
        font-weight: 700;
        font-style: italic;
        font-size: 16px;
        margin-bottom: 2px;
      }

      /* Issuance */
      .issuance-section {
        margin-top: 18px;
        font-size: 16px;
        line-height: 2;
      }

      /* Request / checkboxes */
      .request-section {
        margin-top: 16px;
        font-size: 16px;
        line-height: 2;
      }
      .checkbox-note {
        margin-top: 2px;
        font-style: italic;
        font-size: 14px;
      }
      .checkbox-list {
        margin-top: 7px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .checkbox-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 16px;
        line-height: 1.4;
      }
      .checkbox-box {
        flex-shrink: 0;
        width: 13px;
        height: 13px;
        border: 1.5px solid #111827;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 1px;
        font-size: 10px;
        font-weight: 700;
      }

      /* Signature — anchored to bottom-right of page */
      .signature-section {
        position: absolute;
        right: 10mm;
        bottom: 10mm;
      }
      .patient-qr-section {
        position: absolute;
        left: 10mm;
        bottom: 10mm;
      }
      .patient-qr-block {
        width: 96px;
      }
      .patient-qr-title {
        margin: 0;
        font-size: 7.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #111827;
        padding: 0 0 4px;
      }
      .patient-qr-frame {
        background: transparent;
        padding: 0;
      }
      .patient-qr-box {
        width: 66px;
        height: 66px;
        border: none;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .patient-qr-box svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .patient-qr-fallback {
        font-size: 8px;
        font-weight: 700;
        color: #475569;
        text-align: center;
        line-height: 1.2;
      }
      .patient-qr-code {
        margin: 3px 0 0;
        font-size: 6.5px;
        line-height: 1.2;
        word-break: break-word;
        font-weight: 700;
        color: #111827;
        letter-spacing: 0.02em;
      }
      .signature-block {
        width: 256px;
      }
      .sig-name-line {
        border-bottom: 1.5px solid #111827;
        min-height: 38px;
        margin-bottom: 4px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 3px;
        font-weight: 700;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        text-align: center;
      }
      .sig-caption {
        text-align: center;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .sig-row {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        font-size: 13px;
        margin-top: 4px;
      }
      .sig-row .lbl {
        width: 72px;
        font-weight: 700;
        white-space: nowrap;
      }
      .sig-row .sig-line {
        flex: 1;
        border-bottom: 1px solid #111827;
        min-height: 15px;
        font-size: 13px;
        padding: 0 2px;
      }

      @media print {
        .viewer-actions, .viewer-note { display: none; }
        body { margin: 0; background: transparent; }
        .page {
          width: 210mm;
          min-height: 297mm;
          margin: 0;
          border: none;
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

    <main class="page">
      <img class="watermark" src="/cprmedlogotansparent.png" alt="" aria-hidden="true" />

      <!-- ── Header ── -->
      <header class="header">
        <div class="header-logo-col">
          <img class="logo" src="/cprmedlogotansparent.png" alt="CPRMED Logo" />
        </div>

        <div class="header-center-col">
          <p class="clinic-name"><span class="name-cpr">CPR</span><span class="name-med">MED</span></p>
          <p class="clinic-subtitle">CPR Medical Clinic &amp; Laboratory</p>
          <p class="clinic-address">${escapeHtml(input.clinicAddress || 'N.Bacalso Ave., Bulacao Pardo, Cebu City')}</p>
          <p class="clinic-contact">${escapeHtml(input.clinicContactNumber || '09623093577')}</p>
          <p class="specialties-bar">General Surgery, Internal Medicine, OB-Gyne, Pediatrics, Family Medicine, Aesthetic Medicine, Addiction Medicine, Anesthesiologist, Cardiologist, Ophthalmologist, ENT, Diabetologist, Nephrologist.</p>
        </div>

        <div class="header-hours-col hours">
          <div>
            <p class="label">Clinic Hours</p>
            <p class="schedule">Monday-Sunday:<br/>10:00 AM – 10:00 PM</p>
          </div>
          <div class="cert-meta-block">
            <div class="cert-meta-row">
              <span class="ml">Certificate No:</span>
              <span class="ml-line">${escapeHtml(input.certificateNumber)}</span>
            </div>
            <div class="cert-meta-row patient-code-row">
              <span class="ml">Patient Code:</span>
              <span class="ml-line">${escapeHtml(healthRecordNumber)}</span>
            </div>
            <div class="cert-meta-row">
              <span class="ml">Date:</span>
              <span class="ml-line">${escapeHtml(toDisplayDate(input.issuedDate))}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- ── Document Title ── -->
      <h1 class="document-title">MEDICAL CERTIFICATE</h1>

      <!-- ── Body ── -->
      <div class="cert-body">

        <p class="intro">To whom it may concern:</p>

        <p class="fill-para">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;This is to certify that <span class="fill-inline">${escapeHtml(input.patientName || 'N/A')}</span>, <span class="fill-inline">${escapeHtml(input.patientAge || 'N/A')}</span> years old (Gender) <span class="fill-inline">${escapeHtml(input.patientSex || 'N/A')}</span> and a resident of <span class="fill-inline">${escapeHtml(input.patientAddress || 'N/A')}</span> was seen and examined with the Diagnosis of <span class="fill-inline">${escapeHtml(input.diagnosis || 'N/A')}</span>.</p>

        <div class="rec-section">
          <p class="sec-title">Recommendation/s: <span class="blank-line">${escapeHtml(input.recommendation)}${escapeHtml(restNote)}</span></p>
        </div>

        <div class="issuance-section">
          Issued this
          <span class="fill-inline sm">${dayStr}</span>
          day of
          <span class="fill-inline md">${monthStr}</span>,
          year
          <span class="fill-inline sm">${yearStr}</span>
          at CPR Medical Clinic &amp; Laboratory, N.Bacalso Ave., Bulacao Pardo Cebu City, Philippines.
        </div>

        <div class="request-section">
          <span>This certificate is being issued at request of</span>
          <span class="fill-inline xl">${escapeHtml(input.patientName)}</span>
          <span>for</span>
          <p class="checkbox-note">(Please check the applicable box below)</p>
          <div class="checkbox-list">
            <div class="checkbox-item">
              <span class="checkbox-box">${checkFinancial ? '&#10003;' : ''}</span>
              <span>Financial and Medical assistance program</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox-box">${checkSchool ? '&#10003;' : ''}</span>
              <span>School Related Purpose, except for insurance claims or any legal claim</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox-box">${checkWork ? '&#10003;' : ''}</span>
              <span>work related purposes, except for insurance claims or any legal claim</span>
            </div>
          </div>
        </div>

      </div>

      <!-- ── Signature ── -->
      <div class="patient-qr-section">
        <div class="patient-qr-block">
          <p class="patient-qr-title">Patient Code</p>
          <div class="patient-qr-frame">
            <div class="patient-qr-box">
              ${
                input.patientQrSvg?.trim()
                  ? input.patientQrSvg
                  : '<span class="patient-qr-fallback">NO<br/>QR</span>'
              }
            </div>
            <p class="patient-qr-code">${escapeHtml(patientQrLabel)}</p>
          </div>
        </div>
      </div>

      <div class="signature-section">
        <div class="signature-block">
          <div class="sig-name-line">${escapeHtml(input.doctorName || '')}</div>
          <p class="sig-caption">Doctor's Name and Signature</p>
          <div class="sig-row">
            <span class="lbl">License no.</span>
            <span class="sig-line">${escapeHtml(input.doctorLicenseNumber || '')}</span>
          </div>
          <div class="sig-row">
            <span class="lbl">PTR no.</span>
            <span class="sig-line">${escapeHtml(input.doctorPtrNumber || '')}</span>
          </div>
          <div class="sig-row">
            <span class="lbl">Tin no.</span>
            <span class="sig-line">${escapeHtml(input.doctorBirNumber || '')}</span>
          </div>
          <div class="sig-row">
            <span class="lbl">S2 no.</span>
            <span class="sig-line"></span>
          </div>
        </div>
      </div>

    </main>
  </body>
</html>`;
}
