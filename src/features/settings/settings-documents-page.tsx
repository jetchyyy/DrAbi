import { Eye, FileText, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { printHtmlDocument } from '../../lib/print';
import { buildMedicalCertificatePrintDocument } from '../patients/medical-certificate-print-document';
import { buildPrescriptionPrintDocument } from '../patients/prescription-print-document';

type DocumentTemplateKey = 'medical_certificate' | 'prescription' | 'medical_abstract';

type DebugTemplateInfo = {
  key: DocumentTemplateKey;
  name: string;
  category: string;
  paperSize: string;
  lastUpdated: string;
};

type DocumentDebugValues = {
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
  patientWeight: string;
  patientCivilStatus: string;
  issuedDate: string;
  medications: Array<{ name: string; dosage: string; instruction: string }>;
  nextAppointment: string;
  certificatePurpose: string;
  diagnosis: string;
  recommendation: string;
  restFrom: string;
  restUntil: string;
  chiefComplaint: string;
  clinicalFindings: string;
  managementPlan: string;
};

const templateRows: DebugTemplateInfo[] = [
  {
    key: 'medical_certificate',
    name: 'Medical Certificate',
    category: 'Clinical Document',
    paperSize: 'A4 Portrait',
    lastUpdated: 'May 02, 2026',
  },
  {
    key: 'prescription',
    name: 'Prescription',
    category: 'Clinical Document',
    paperSize: 'A5 Portrait',
    lastUpdated: 'May 02, 2026',
  },
  {
    key: 'medical_abstract',
    name: 'Medical Abstract',
    category: 'Reference Document',
    paperSize: 'A4 Portrait',
    lastUpdated: 'May 02, 2026',
  },
];

const defaultDebugValues: DocumentDebugValues = {
  clinicName: 'ODC CPRMED Clinic',
  clinicAddress: 'Ground Floor, Maharlika Highway, Cabanatuan City',
  clinicContactNumber: '0917-123-4567',
  clinicEmail: 'clinic@cprmed.local',
  doctorName: 'Dr. Miguel S. Reyes',
  doctorSpecialty: 'Internal Medicine',
  doctorLicenseNumber: 'PRC-1234567',
  doctorBirNumber: 'BIR-00984213',
  doctorPtrNumber: 'PTR-2026-000145',
  doctorPrcQrData: 'https://www.prc.gov.ph/licensee?id=PRC1234567&type=PRC',
  patientName: 'Juan Dela Cruz',
  patientAge: '35',
  patientSex: 'Male',
  patientAddress: 'Maharlika Highway, Cabanatuan City, Nueva Ecija',
  patientWeight: '68 kg',
  patientCivilStatus: 'Single',
  issuedDate: '2026-05-02',
  medications: [
    {
      name: 'Amoxicillin 500mg capsule',
      dosage: '1 capsule every 8 hours for 7 days',
      instruction: 'Take after meals. Complete full course.',
    },
    {
      name: 'Paracetamol 500mg tablet',
      dosage: '1 tablet every 6 hours as needed',
      instruction: 'Take for fever or pain. Do not exceed 4g/day.',
    },
  ],
  nextAppointment: '2026-05-09',
  certificatePurpose: 'School / Work Requirement',
  diagnosis: 'Acute upper respiratory tract infection',
  recommendation: 'Continue oral hydration and complete prescribed medication.',
  restFrom: '2026-05-02',
  restUntil: '2026-05-04',
  chiefComplaint: 'Persistent productive cough with low-grade fever for 3 days.',
  clinicalFindings: 'Stable vitals, mildly erythematous pharynx, clear breath sounds with minimal crackles.',
  managementPlan: 'Home isolation for 48 hours, supportive medications, follow-up if symptoms worsen.',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMedicalAbstractPreviewDocument(values: DocumentDebugValues) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Medical Abstract</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, Helvetica, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      @page {
        size: A4 portrait;
        margin: 12mm;
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
      }

      .viewer-actions button {
        border: 0;
        border-radius: 999px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
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
        max-width: 190mm;
        min-height: calc(297mm - 24mm);
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        padding: 12mm;
      }

      .header {
        border-bottom: 2px solid #0f172a;
        padding-bottom: 8px;
      }

      .header h1 {
        margin: 0;
        font-size: 18px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .header p {
        margin: 3px 0 0;
        font-size: 12px;
        color: #334155;
      }

      .document-title {
        margin: 16px 0 2px;
        text-align: center;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .meta {
        margin: 14px 0;
        display: grid;
        gap: 8px;
        grid-template-columns: 1fr 1fr;
        font-size: 12px;
      }

      .section {
        margin-top: 14px;
      }

      .section h2 {
        margin: 0 0 6px;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .box {
        border: 1px solid #cbd5e1;
        min-height: 72px;
        padding: 10px;
        font-size: 12px;
        line-height: 1.6;
        white-space: pre-wrap;
      }

      .signature {
        margin-top: 38px;
        display: flex;
        justify-content: flex-end;
      }

      .signature-block {
        min-width: 220px;
      }

      .line {
        border-bottom: 1px solid #0f172a;
        margin-bottom: 6px;
      }

      .signature-block p {
        margin: 2px 0;
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <div class="viewer-actions" aria-hidden="true">
      <button class="print" type="button" onclick="window.print()">Print</button>
      <button class="pdf" type="button" onclick="window.print()">Save PDF</button>
    </div>
    <p class="viewer-note">Debug preview mode: validate spacing, alignment, and overflow before final print.</p>

    <main class="page">
      <header class="header">
        <h1>${escapeHtml(values.clinicName)}</h1>
        <p>${escapeHtml(values.clinicAddress)}</p>
        <p>${escapeHtml(values.clinicContactNumber)} · ${escapeHtml(values.clinicEmail)}</p>
      </header>

      <h2 class="document-title">Medical Abstract</h2>

      <div class="meta">
        <p><strong>Patient:</strong> ${escapeHtml(values.patientName)}</p>
        <p><strong>Date Issued:</strong> ${escapeHtml(values.issuedDate)}</p>
      </div>

      <section class="section">
        <h2>Chief Complaint</h2>
        <div class="box">${escapeHtml(values.chiefComplaint)}</div>
      </section>

      <section class="section">
        <h2>Clinical Findings</h2>
        <div class="box">${escapeHtml(values.clinicalFindings)}</div>
      </section>

      <section class="section">
        <h2>Management Plan</h2>
        <div class="box">${escapeHtml(values.managementPlan)}</div>
      </section>

      <div class="signature">
        <div class="signature-block">
          <div class="line"></div>
          <p><strong>${escapeHtml(values.doctorName)}</strong></p>
          <p>${escapeHtml(values.doctorSpecialty)}</p>
          <p>PRC: ${escapeHtml(values.doctorLicenseNumber)}</p>
        </div>
      </div>
    </main>
  </body>
</html>`;
}

export function SettingsDocumentsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplateKey>('medical_certificate');
  const [debugValues, setDebugValues] = useState<DocumentDebugValues>(defaultDebugValues);
  const [printing, setPrinting] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);

  const previewHtml = useMemo(() => {
    if (selectedTemplate === 'prescription') {
      return buildPrescriptionPrintDocument({
        clinicName: debugValues.clinicName,
        clinicAddress: debugValues.clinicAddress,
        clinicContactNumber: debugValues.clinicContactNumber,
        clinicEmail: debugValues.clinicEmail,
        doctorName: debugValues.doctorName,
        doctorSpecialty: debugValues.doctorSpecialty,
        doctorLicenseNumber: debugValues.doctorLicenseNumber,
        doctorBirNumber: debugValues.doctorBirNumber,
        doctorPtrNumber: debugValues.doctorPtrNumber,
        doctorPrcQrData: debugValues.doctorPrcQrData,
        patientName: debugValues.patientName,
        patientAge: debugValues.patientAge,
        patientSex: debugValues.patientSex,
        patientAddress: debugValues.patientAddress,
        patientWeight: debugValues.patientWeight,
        patientCivilStatus: debugValues.patientCivilStatus,
        issuedDate: debugValues.issuedDate,
        medications: debugValues.medications,
        nextAppointment: debugValues.nextAppointment,
      });
    }

    if (selectedTemplate === 'medical_abstract') {
      return buildMedicalAbstractPreviewDocument(debugValues);
    }

    return buildMedicalCertificatePrintDocument({
      clinicName: debugValues.clinicName,
      clinicAddress: debugValues.clinicAddress,
      clinicContactNumber: debugValues.clinicContactNumber,
      clinicEmail: debugValues.clinicEmail,
      doctorName: debugValues.doctorName,
      doctorSpecialty: debugValues.doctorSpecialty,
      doctorLicenseNumber: debugValues.doctorLicenseNumber,
      doctorBirNumber: debugValues.doctorBirNumber,
      doctorPtrNumber: debugValues.doctorPtrNumber,
      doctorPrcQrData: debugValues.doctorPrcQrData,
      patientName: debugValues.patientName,
      patientAge: debugValues.patientAge,
      patientSex: debugValues.patientSex,
      patientAddress: debugValues.patientAddress,
      issuedDate: debugValues.issuedDate,
      certificatePurpose: debugValues.certificatePurpose,
      diagnosis: debugValues.diagnosis,
      recommendation: debugValues.recommendation,
      restFrom: debugValues.restFrom,
      restUntil: debugValues.restUntil,
      checkFinancial: false,
      checkSchool: true,
      checkWork: false,
    });
  }, [debugValues, selectedTemplate]);

  const selectedTemplateName = templateRows.find((template) => template.key === selectedTemplate)?.name ?? 'Document';

  const updateValue = (field: keyof Omit<DocumentDebugValues, 'medications'>, value: string) => {
    setDebugValues((current) => ({ ...current, [field]: value }));
  };

  const updateMedication = (index: number, field: 'name' | 'dosage' | 'instruction', value: string) => {
    setDebugValues((current) => {
      const updated = current.medications.map((med, i) =>
        i === index ? { ...med, [field]: value } : med,
      );
      return { ...current, medications: updated };
    });
  };

  const addMedication = () => {
    setDebugValues((current) => ({
      ...current,
      medications: [...current.medications, { name: '', dosage: '', instruction: '' }],
    }));
  };

  const removeMedication = (index: number) => {
    setDebugValues((current) => ({
      ...current,
      medications: current.medications.filter((_, i) => i !== index),
    }));
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printHtmlDocument(previewHtml);
    } catch {
      toast.error('Unable to open print preview.');
    } finally {
      setPrinting(false);
    }
  };

  const handleSavePdf = async () => {
    setSavingPdf(true);
    toast.message('When the print dialog opens, choose Save as PDF.');
    try {
      await printHtmlDocument(previewHtml);
    } catch {
      toast.error('Unable to open PDF export dialog.');
    } finally {
      setSavingPdf(false);
    }
  };

  const resetInputs = () => {
    setDebugValues(defaultDebugValues);
    toast.success('Static debug inputs reset.');
  };

  return (
    <div className="space-y-6">
      <div className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 bg-orange-600 p-2.5 text-white">
              <FileText className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Documents</h1>
              <p className="mt-1 text-sm text-slate-500">Administration document templates with static inputs for print-preview debugging.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-orange-700">
            <Eye className="size-3.5" />
            Debug Preview Enabled
          </div>
        </div>
      </div>

      <Card className="rounded-none border border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <CardTitle className="text-base font-extrabold tracking-tight">Document Templates</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Choose a template to inspect layout behavior and print output.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Document</th>
                <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Category</th>
                <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Paper</th>
                <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Last Updated</th>
                <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templateRows.map((template) => (
                <tr className="hover:bg-slate-50" key={template.key}>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{template.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{template.category}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{template.paperSize}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{template.lastUpdated}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-widest text-slate-700 hover:underline"
                      onClick={() => setSelectedTemplate(template.key)}
                      type="button"
                    >
                      <Eye className="size-3.5" />
                      Load Preview
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="rounded-none border border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <CardTitle className="text-base font-extrabold tracking-tight">Static Inputs</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Adjust placeholders and verify wrapping in print preview.</p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <FormField label="Document template">
              <Select
                onChange={(event) => setSelectedTemplate(event.target.value as DocumentTemplateKey)}
                value={selectedTemplate}
              >
                <option value="medical_certificate">Medical Certificate</option>
                <option value="prescription">Prescription</option>
                <option value="medical_abstract">Medical Abstract</option>
              </Select>
            </FormField>

            <FormField label="Clinic name">
              <Input onChange={(event) => updateValue('clinicName', event.target.value)} value={debugValues.clinicName} />
            </FormField>

            <FormField label="Patient name">
              <Input onChange={(event) => updateValue('patientName', event.target.value)} value={debugValues.patientName} />
            </FormField>

            <FormField label="Doctor name">
              <Input onChange={(event) => updateValue('doctorName', event.target.value)} value={debugValues.doctorName} />
            </FormField>

            <FormField label="Issued date">
              <Input onChange={(event) => updateValue('issuedDate', event.target.value)} type="date" value={debugValues.issuedDate} />
            </FormField>

            {selectedTemplate === 'prescription' ? (
              <>
                <FormField label="Patient age">
                  <Input onChange={(event) => updateValue('patientAge', event.target.value)} value={debugValues.patientAge} />
                </FormField>
                <FormField label="Patient sex">
                  <Input onChange={(event) => updateValue('patientSex', event.target.value)} value={debugValues.patientSex} />
                </FormField>
                <FormField label="Patient address">
                  <Input onChange={(event) => updateValue('patientAddress', event.target.value)} value={debugValues.patientAddress} />
                </FormField>
                <FormField label="Civil status">
                  <Input onChange={(event) => updateValue('patientCivilStatus', event.target.value)} value={debugValues.patientCivilStatus} />
                </FormField>
                <FormField label="Weight">
                  <Input onChange={(event) => updateValue('patientWeight', event.target.value)} value={debugValues.patientWeight} />
                </FormField>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Prescriptions</span>
                    <button
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                      onClick={addMedication}
                      type="button"
                    >
                      <Plus className="size-3.5" />
                      Add
                    </button>
                  </div>
                  {debugValues.medications.map((med, index) => (
                    <div className="space-y-2 border border-slate-200 bg-slate-50 p-3" key={index}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">#{index + 1}</span>
                        {debugValues.medications.length > 1 ? (
                          <button
                            className="text-xs font-bold text-red-500 hover:underline"
                            onClick={() => removeMedication(index)}
                            type="button"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <FormField label="Medication name">
                        <Input onChange={(event) => updateMedication(index, 'name', event.target.value)} value={med.name} />
                      </FormField>
                      <FormField label="Dosage">
                        <Input onChange={(event) => updateMedication(index, 'dosage', event.target.value)} value={med.dosage} />
                      </FormField>
                      <FormField label="Instruction">
                        <Textarea onChange={(event) => updateMedication(index, 'instruction', event.target.value)} value={med.instruction} />
                      </FormField>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {selectedTemplate === 'medical_certificate' ? (
              <>
                <FormField label="Certificate purpose">
                  <Input onChange={(event) => updateValue('certificatePurpose', event.target.value)} value={debugValues.certificatePurpose} />
                </FormField>
                <FormField label="Diagnosis">
                  <Textarea onChange={(event) => updateValue('diagnosis', event.target.value)} value={debugValues.diagnosis} />
                </FormField>
                <FormField label="Recommendation">
                  <Textarea onChange={(event) => updateValue('recommendation', event.target.value)} value={debugValues.recommendation} />
                </FormField>
              </>
            ) : null}

            {selectedTemplate === 'medical_abstract' ? (
              <>
                <FormField label="Chief complaint">
                  <Textarea onChange={(event) => updateValue('chiefComplaint', event.target.value)} value={debugValues.chiefComplaint} />
                </FormField>
                <FormField label="Clinical findings">
                  <Textarea onChange={(event) => updateValue('clinicalFindings', event.target.value)} value={debugValues.clinicalFindings} />
                </FormField>
                <FormField label="Management plan">
                  <Textarea onChange={(event) => updateValue('managementPlan', event.target.value)} value={debugValues.managementPlan} />
                </FormField>
              </>
            ) : null}

            <Button
              className="w-full rounded-none border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={resetInputs}
              type="button"
              variant="secondary"
            >
              <RotateCcw className="mr-2 size-4" />
              Reset Static Inputs
            </Button>
          </div>
        </Card>

        <Card className="rounded-none border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div>
              <CardTitle className="text-base font-extrabold tracking-tight">{selectedTemplateName} Preview</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Live preview generated from static form values.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button className="rounded-none" disabled={printing || savingPdf} onClick={() => void handlePrint()} type="button">
                <Printer className="mr-2 size-4" />
                {printing ? 'Opening...' : 'Print'}
              </Button>
              <Button
                className="rounded-none border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                disabled={printing || savingPdf}
                onClick={() => void handleSavePdf()}
                type="button"
                variant="secondary"
              >
                <FileText className="mr-2 size-4" />
                {savingPdf ? 'Opening...' : 'Save PDF'}
              </Button>
            </div>
          </div>
          <div className="bg-slate-100 p-3">
            <iframe className="h-[820px] w-full border border-slate-300 bg-white" srcDoc={previewHtml} title={`${selectedTemplateName} preview`} />
          </div>
        </Card>
      </div>
    </div>
  );
}