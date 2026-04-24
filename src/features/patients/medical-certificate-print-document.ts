interface MedicalCertificatePrintDocumentInput {
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
  issuedDate: string;
  certificatePurpose: string;
  diagnosis: string;
  recommendation: string;
  restFrom: string;
  restUntil: string;
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
  const restWindow = input.restFrom && input.restUntil
    ? `${toDisplayDate(input.restFrom)} to ${toDisplayDate(input.restUntil)}`
    : input.restFrom
      ? `starting ${toDisplayDate(input.restFrom)}`
      : input.restUntil
        ? `until ${toDisplayDate(input.restUntil)}`
        : 'as clinically advised';

  const qrCodeImageUrl = input.doctorPrcQrData
    ? `https://quickchart.io/qr?text=${encodeURIComponent(input.doctorPrcQrData)}&size=240&ecLevel=M&margin=1&format=svg`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Medical Certificate</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Georgia, "Times New Roman", serif;
      }
      * {
        box-sizing: border-box;
      }
      @page {
        size: A5 portrait;
        margin: 10mm;
      }
      body {
        margin: 0;
        background: #f5f5f4;
        color: #111827;
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
      .page {
        width: 100%;
        max-width: 170mm;
        height: calc(210mm - 20mm);
        margin: 0 auto;
        padding: 8mm 9mm 10mm;
        background: #ffffff;
        border: 1px solid #e7e5e4;
        display: flex;
        flex-direction: column;
      }
      .header-title {
        margin: 0;
        text-align: center;
        font-size: 17px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
      }

      .header-subtitle {
        margin: 5px 0 2px;
        text-align: center;
        font-size: 12px;
        font-weight: 600;
      }

      .header-role {
        margin: 0;
        text-align: center;
        font-size: 11px;
      }
      .contact-grid {
        margin-top: 9px;
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        font-size: 10px;
        line-height: 1.4;
      }
      .contact-grid p,
      .cert-content p,
      .signature p {
        margin: 0;
      }

      .contact-cell {
        min-height: 54px;
      }

      .center-cell {
        border-left: 1px solid #9ca3af;
        border-right: 1px solid #9ca3af;
        padding: 0 10px;
      }

      .document-title {
        margin: 14px 0 0;
        text-align: center;
        font-size: 16px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
      }

      .date-row {
        margin-top: 6px;
        display: flex;
        justify-content: flex-end;
        font-size: 11px;
      }

      .cert-content {
        margin-top: 10px;
        flex: 1;
        border: none;
        padding: 0;
        font-size: 12px;
        line-height: 1.65;
      }

      .cert-content p {
        margin: 0;
      }

      .cert-content p + p {
        margin-top: 6px;
      }

      .cert-content .indented {
        text-indent: 26px;
      }

      .meta-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        font-size: 11px;
      }

      .meta-label {
        font-weight: 700;
      }

      .meta-line {
        flex: 1;
        border-bottom: 1px solid #374151;
        min-height: 16px;
      }

      .footer {
        margin-top: auto;
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-end;
      }

      .next-visit {
        font-size: 10px;
      }

      .next-visit .line {
        width: 160px;
        border-bottom: 1px solid #374151;
        margin-top: 36px;
      }

      .signature {
        min-width: 180px;
        text-align: left;
      }

      .credentials-row {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        margin-top: 2px;
      }

      .doctor-prc-qr {
        width: 50px;
        text-align: center;
      }

      .doctor-prc-qr img {
        width: 46px;
        height: 46px;
        object-fit: contain;
        border: 1px solid #d1d5db;
        padding: 1px;
      }

      .doctor-prc-qr p {
        margin-top: 2px;
        font-size: 6px;
        line-height: 1.2;
        color: #4b5563;
      }

      .signature .line {
        border-top: 1px solid #111827;
        margin-bottom: 3px;
      }

      .signature p {
        margin: 0;
        font-size: 9px;
        line-height: 1.35;
      }

      .signature .name {
        letter-spacing: 0.2em;
        text-transform: uppercase;
        font-weight: 600;
      }

      .license-grid {
        flex: 1;
      }

      .license-grid p {
        display: flex;
        gap: 8px;
        align-items: baseline;
      }

      .license-grid .label {
        min-width: 50px;
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
          width: 100%;
          height: auto;
          min-height: 100vh;
          border: 0;
          padding: 0;
        }
        .footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0 9mm 8mm;
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
      <h1 class="header-title">${escapeHtml(input.clinicName || 'Clinic')}</h1>
      <p class="header-subtitle">${escapeHtml(input.doctorName || 'Attending Physician')}</p>
      <p class="header-role">${escapeHtml(input.doctorSpecialty || 'Physician')}</p>
      <section class="contact-grid">
        <div class="contact-cell">
          <p><strong>Address:</strong></p>
          <p>${escapeHtml(input.clinicAddress || 'Address not configured')}</p>
        </div>
        <div class="contact-cell center-cell">
          <p><strong>Contact:</strong></p>
          <p>${escapeHtml(input.clinicContactNumber || 'Not provided')}</p>
          <p>${escapeHtml(input.clinicEmail || 'Not provided')}</p>
        </div>
        <div class="contact-cell">
          <p><strong>Clinic hours:</strong></p>
          <p>See clinic schedule</p>
        </div>
      </section>

      <div class="document-title">MEDICAL CERTIFICATE</div>

      <div class="date-row">Date Issued: ${escapeHtml(toDisplayDate(input.issuedDate))}</div>

      <section class="cert-content">
        <p class="indented">To whom it may concern:</p>
        <p class="indented">This is to certify that <strong>${escapeHtml(input.patientName)}</strong> was seen and medically evaluated in this clinic.</p>
        <p class="indented">Clinical impression / diagnosis: <strong>${escapeHtml(input.diagnosis)}</strong>.</p>
        <p class="indented">Recommendation: ${escapeHtml(input.recommendation)}.</p>
        <p class="indented">The patient is advised to observe rest ${escapeHtml(restWindow)}.</p>
        <p class="indented">This certificate is issued upon the request of the patient for <strong>${escapeHtml(input.certificatePurpose)}</strong>.</p>
      </section>
      <footer class="footer">
        <div class="next-visit">
          <p>${escapeHtml(input.patientName)}</p>
          <div class="line"></div>
        </div>

        <div class="signature">
          <div class="line"></div>
          <p class="name">${escapeHtml(input.doctorName || 'Physician')}</p>
          <p>${escapeHtml(input.doctorSpecialty || 'Physician')}</p>
          <div class="credentials-row">
            <div class="license-grid">
              <p><span class="label">PRC Lic. No.:</span><span>${escapeHtml(input.doctorLicenseNumber || '________________')}</span></p>
              <p><span class="label">BIR No.:</span><span>${escapeHtml(input.doctorBirNumber || '________________')}</span></p>
              <p><span class="label">PTR No.:</span><span>${escapeHtml(input.doctorPtrNumber || '________________')}</span></p>
            </div>
            ${qrCodeImageUrl ? `<div class="doctor-prc-qr"><img alt="Doctor PRC QR" src="${qrCodeImageUrl}" /><p>PRC QR</p></div>` : ''}
          </div>
        </div>
      </footer>
    </main>
  </body>
</html>`;
}
