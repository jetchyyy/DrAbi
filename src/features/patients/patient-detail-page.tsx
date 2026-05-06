import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Eye, FileText, FlaskConical, Pill, Plus, QrCode, ScanLine, TestTubeDiagonal, Trash2, X, Activity } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useClinicSettingsData, useProviderDirectory } from '../../hooks/use-clinic-data';
import { getDatabase } from '../../lib/local-db';
import { printHtmlDocument } from '../../lib/print';
import { formatDateLabel, formatDateTimeLabel } from '../../lib/utils';
import type { MedicalCertificate, Prescription } from '../../types/domain';
import { useAuth } from '../auth/auth-context';
import { LabResultsDisplay } from '../consultation/components/lab-results-display';
import { extractInventoryItemQrCode } from '../inventory/inventory-qr';
import { DocumentStatusModal } from './components/document-status-modal';
import { PatientQrCard } from './components/patient-qr-card';
import {
  useCreateMedicalCertificate,
  useCreatePrescription,
  usePatientAppointments,
  usePatientConsultations,
  usePatientDetail,
  usePatientMedicalCertificates,
  usePatientPrescriptions,
  useRecordInventoryUsage,
  useUpdatePatient,
} from './hooks/use-patients';
import { buildMedicalCertificatePrintDocument } from './medical-certificate-print-document';
import { buildPrescriptionPrintDocument } from './prescription-print-document';
import { useCreateReferral, useReferrals, useUpdateReferralOutcome, useUpdateReferralStatus } from '../referrals/hooks/use-referrals';

const referralSchema = z.object({
  targetDoctorId: z.string().min(1),
  reason: z.string().min(4),
  clinicalSummary: z.string().min(8),
  referralNotes: z.string().min(4),
});

const specialistUpdateSchema = z.object({
  specialistVisitedAt: z.string().min(1),
  specialistFindings: z.string().min(8),
  specialistRecommendations: z.string().min(8),
  status: z.enum(['accepted', 'completed']),
});

const frontDeskConfirmationSchema = z.object({
  status: z.enum(['confirmed', 'cancelled']),
  referralNotes: z.string().min(4),
});

const prescriptionSchema = z.object({
  consultationId: z.string().min(1, 'Save a consultation first or choose an existing one.'),
});

const medicalCertificateSchema = z.object({
  consultationId: z.string().min(1, 'Save a consultation first or choose an existing one.'),
  certificatePurpose: z.string().min(2, 'Certificate purpose is required.'),
  diagnosis: z.string().min(2, 'Diagnosis is required.'),
  recommendation: z.string().min(2, 'Recommendation is required.'),
  restFrom: z.string().optional(),
  restUntil: z.string().optional(),
  checkFinancial: z.boolean().optional(),
  checkSchool: z.boolean().optional(),
  checkWork: z.boolean().optional(),
});

const inventoryUsageSchema = z.object({
  scannedCode: z.string().min(1, 'Scan or paste the inventory QR code.'),
  appointmentId: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1.'),
  notes: z.string().min(4, 'Add a short note about how the item was used.'),
});

const vitalsSchema = z.object({
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
  respiratoryRate: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
}).refine(
  (data) => Object.values(data).some(v => v && v.trim()),
  { message: 'At least one vital must be recorded' }
);

function formatConsultationText(value: string | null | undefined) {
  const text = (value ?? '').trim();
  return text.length > 0 ? text : 'Not provided';
}

interface VitalsData {
  temperature?: string;
  bloodPressure?: string;
  heartRate?: string;
  respiratoryRate?: string;
  weight?: string;
  height?: string;
  vitalsRecordedAt?: string | null;
}

function parseVitalsFromText(text: string): VitalsData {
  const vitals: VitalsData = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('Temperature:')) {
      vitals.temperature = line.replace('Temperature:', '').trim().replace(' C', '');
    } else if (line.includes('Blood Pressure:')) {
      vitals.bloodPressure = line.replace('Blood Pressure:', '').trim().replace(' mmHg', '');
    } else if (line.includes('Heart Rate:')) {
      vitals.heartRate = line.replace('Heart Rate:', '').trim().replace(' bpm', '');
    } else if (line.includes('Respiratory Rate:')) {
      vitals.respiratoryRate = line.replace('Respiratory Rate:', '').trim().replace(' breaths/min', '');
    } else if (line.includes('Weight:')) {
      vitals.weight = line.replace('Weight:', '').trim().replace(' kg', '');
    } else if (line.includes('Height:')) {
      vitals.height = line.replace('Height:', '').trim().replace(' cm', '');
    } else if (line.includes('Recorded at intake:')) {
      vitals.vitalsRecordedAt = line.replace('Recorded at intake:', '').trim();
    }
  }
  
  return vitals;
}

function buildPatientVitalsText(patient: {
  temperature?: string;
  bloodPressure?: string;
  heartRate?: string;
  respiratoryRate?: string;
  weight?: string;
  height?: string;
  vitalsRecordedAt?: string | null;
} | null | undefined) {
  if (!patient) {
    return '';
  }

  const lines: string[] = [];
  if (patient.temperature) {
    lines.push(`Temperature: ${patient.temperature} C`);
  }
  if (patient.bloodPressure) {
    lines.push(`Blood Pressure: ${patient.bloodPressure} mmHg`);
  }
  if (patient.heartRate) {
    lines.push(`Heart Rate: ${patient.heartRate} bpm`);
  }
  if (patient.respiratoryRate) {
    lines.push(`Respiratory Rate: ${patient.respiratoryRate} breaths/min`);
  }
  if (patient.weight) {
    lines.push(`Weight: ${patient.weight} kg`);
  }
  if (patient.height) {
    lines.push(`Height: ${patient.height} cm`);
  }
  if (patient.vitalsRecordedAt) {
    lines.push(`Recorded at intake: ${formatDateTimeLabel(patient.vitalsRecordedAt)}`);
  }

  return lines.join('\n');
}

function truncateText(value: string | null | undefined, maxLength = 120) {
  const text = formatConsultationText(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function buildSavedPrescriptionDocument(input: {
  patientName: string;
  patientAge?: string;
  patientSex?: string;
  patientAddress?: string;
  patientWeight?: string;
  patientCivilStatus?: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorLicenseNumber: string;
  doctorBirNumber: string;
  doctorPtrNumber: string;
  doctorPrcQrData: string;
  clinicName: string;
  clinicAddress: string;
  clinicContactNumber: string;
  clinicEmail: string;
  prescriptions: Prescription[];
  issuedDate: string;
  nextAppointment: string;
}) {
  return buildPrescriptionPrintDocument({
    clinicName: input.clinicName,
    clinicAddress: input.clinicAddress,
    clinicContactNumber: input.clinicContactNumber,
    clinicEmail: input.clinicEmail,
    doctorName: input.doctorName,
    doctorSpecialty: input.doctorSpecialty,
    doctorLicenseNumber: input.doctorLicenseNumber,
    doctorBirNumber: input.doctorBirNumber,
    doctorPtrNumber: input.doctorPtrNumber,
    doctorPrcQrData: input.doctorPrcQrData,
    patientName: input.patientName,
    patientAge: input.patientAge,
    patientSex: input.patientSex,
    patientAddress: input.patientAddress,
    patientWeight: input.patientWeight,
    patientCivilStatus: input.patientCivilStatus,
    issuedDate: input.issuedDate,
    medications: input.prescriptions.map((p) => ({
      name: p.prescriptionName,
      dosage: p.dosage,
      instruction: p.instruction,
    })),
    nextAppointment: input.nextAppointment,
  });
}

function buildDoctorPrcResultQrData(input: {
  doctorName: string;
  doctorSpecialty: string;
  doctorLicenseNumber: string;
  doctorBirNumber: string;
  doctorPtrNumber: string;
}) {
  const prcLicense = (input.doctorLicenseNumber || '').replace(/\s+/g, '').toUpperCase();
  
  if (!prcLicense) {
    return '';
  }

  // Direct link to PRC verification page
  return `https://www.prc.gov.ph/licensee?id=${encodeURIComponent(prcLicense)}&type=PRC`;
}

function formatDoctorDisplayName(name: string | null | undefined, postNominals?: string | null) {
  const baseName = (name ?? '').trim().replace(/^dr\.?\s+/i, '').trim();
  if (!baseName) {
    return 'Attending Physician';
  }

  const suffix = (postNominals ?? '').trim();
  return suffix ? `Dr. ${baseName} ${suffix}` : `Dr. ${baseName}`;
}

function buildSavedMedicalCertificateDocument(input: {
  patientName: string;
  patientAge: string;
  patientSex: string;
  patientAddress: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorLicenseNumber: string;
  doctorBirNumber: string;
  doctorPtrNumber: string;
  doctorPrcQrData: string;
  clinicName: string;
  clinicAddress: string;
  clinicContactNumber: string;
  clinicEmail: string;
  medicalCertificate: MedicalCertificate;
  checkFinancial: boolean;
  checkSchool: boolean;
  checkWork: boolean;
}) {
  return buildMedicalCertificatePrintDocument({
    clinicName: input.clinicName,
    clinicAddress: input.clinicAddress,
    clinicContactNumber: input.clinicContactNumber,
    clinicEmail: input.clinicEmail,
    doctorName: input.doctorName,
    doctorSpecialty: input.doctorSpecialty,
    doctorLicenseNumber: input.doctorLicenseNumber,
    doctorBirNumber: input.doctorBirNumber,
    doctorPtrNumber: input.doctorPtrNumber,
    doctorPrcQrData: input.doctorPrcQrData,
    patientName: input.patientName,
    patientAge: input.patientAge,
    patientSex: input.patientSex,
    patientAddress: input.patientAddress,
    issuedDate: input.medicalCertificate.createdAt,
    certificatePurpose: input.medicalCertificate.certificatePurpose,
    diagnosis: input.medicalCertificate.diagnosis,
    recommendation: input.medicalCertificate.recommendation,
    restFrom: input.medicalCertificate.restFrom ?? '',
    restUntil: input.medicalCertificate.restUntil ?? '',
    checkFinancial: input.checkFinancial,
    checkSchool: input.checkSchool,
    checkWork: input.checkWork,
  });
}

export function PatientDetailPage() {
  const { patientId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: providers = [] } = useProviderDirectory();
  const { data: referrals = [] } = useReferrals(patientId || null);
  const createReferral = useCreateReferral(patientId || null);
  const updateReferralOutcome = useUpdateReferralOutcome(patientId || null);
  const updateReferralStatus = useUpdateReferralStatus(patientId || null);
  const createMedicalCertificate = useCreateMedicalCertificate();
  const createPrescription = useCreatePrescription();
  const recordInventoryUsage = useRecordInventoryUsage();
  const patientQuery = usePatientDetail(patientId || null);
  const { data: patient } = patientQuery;
  const { data: visits = [] } = usePatientAppointments(patientId || null);
  const { data: consultations = [] } = usePatientConsultations(patientId || null);
  const { data: medicalCertificates = [] } = usePatientMedicalCertificates(patientId || null);
  const { data: prescriptions = [] } = usePatientPrescriptions(patientId || null);
  const database = getDatabase();

  const currentDoctor = providers.find((doctor) => doctor.profileId === profile?.id);
  const assignableDoctors = providers.filter(
    (doctor) =>
      doctor.role === 'specialist' &&
      doctor.id !== currentDoctor?.id &&
      doctor.profileId !== profile?.id,
  );
  const canClinicalActions = profile?.role === 'doctor' || profile?.role === 'owner_admin' || profile?.role === 'nurse_staff';
  const canDoctorActions = profile?.role === 'doctor' || profile?.role === 'owner_admin';
  const canInventoryActions = profile?.role === 'doctor' || profile?.role === 'owner_admin' || profile?.role === 'nurse_staff' || profile?.role === 'front_desk_cashier';
  const referralForm = useForm<z.infer<typeof referralSchema>>({
    resolver: zodResolver(referralSchema),
    defaultValues: {
      targetDoctorId: '',
      reason: '',
      clinicalSummary: '',
      referralNotes: '',
    },
  });
  const specialistForm = useForm<z.infer<typeof specialistUpdateSchema>>({
    resolver: zodResolver(specialistUpdateSchema),
    defaultValues: {
      specialistVisitedAt: '2026-03-31T09:00',
      specialistFindings: '',
      specialistRecommendations: '',
      status: 'completed',
    },
  });
  const frontDeskForm = useForm<z.infer<typeof frontDeskConfirmationSchema>>({
    resolver: zodResolver(frontDeskConfirmationSchema),
    defaultValues: {
      status: 'confirmed',
      referralNotes: '',
    },
  });
  const prescriptionForm = useForm<z.infer<typeof prescriptionSchema>>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      consultationId: '',
    },
  });
  const medicalCertificateForm = useForm<z.infer<typeof medicalCertificateSchema>>({
    resolver: zodResolver(medicalCertificateSchema),
    defaultValues: {
      consultationId: '',
      certificatePurpose: '',
      diagnosis: '',
      recommendation: '',
      restFrom: '',
      restUntil: '',
      checkFinancial: false,
      checkSchool: false,
      checkWork: false,
    },
  });
  const inventoryUsageForm = useForm<z.infer<typeof inventoryUsageSchema>>({
    resolver: zodResolver(inventoryUsageSchema),
    defaultValues: {
      scannedCode: '',
      appointmentId: '',
      quantity: 1,
      notes: '',
    },
  });

  const labOrders = patient ? database.labOrders.filter((order) => order.patientId === patient.id) : [];
  const inventoryUsageLogs = patient
    ? database.inventoryUsageLogs
      .filter((log) => log.patientId === patient.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : [];
  const [labSearch, setLabSearch] = useState('');
  const [labStatusFilter, setLabStatusFilter] = useState('all');
  const [labExpanded, setLabExpanded] = useState(false);

  const filteredLabOrders = useMemo(() => {
    return labOrders.filter((o) => {
      const svc = database.labServices.find((s) => s.id === o.labServiceId);
      const matchSearch = !labSearch || svc?.name?.toLowerCase().includes(labSearch.toLowerCase());
      const matchStatus = labStatusFilter === 'all' || o.status === labStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [labOrders, labSearch, labStatusFilter, database]);
  const consultationAppointmentIds = new Set(consultations.map((consultation) => consultation.appointmentId));
  const openedFromQr = searchParams.get('source') === 'qr';
  const scannedInventoryCode = extractInventoryItemQrCode(inventoryUsageForm.watch('scannedCode'));
  const scannedInventoryItem = database.inventoryItems.find((item) => item.qrCode === scannedInventoryCode) ?? null;
  const [showPrescriptionStatusModal, setShowPrescriptionStatusModal] = useState(false);
  const [savedPrescription, setSavedPrescription] = useState<Prescription | null>(null);
  const [showMedicalCertificateStatusModal, setShowMedicalCertificateStatusModal] = useState(false);
  const [savedMedicalCertificate, setSavedMedicalCertificate] = useState<MedicalCertificate | null>(null);
  const [savedMedicalCertificateCheckboxes, setSavedMedicalCertificateCheckboxes] = useState({ checkFinancial: false, checkSchool: false, checkWork: false });
  const [isViewingLatestMedicalCertificateFile, setIsViewingLatestMedicalCertificateFile] = useState(false);
  const [isPrintingMedicalCertificate, setIsPrintingMedicalCertificate] = useState(false);
  const [isSavingMedicalCertificatePdf, setIsSavingMedicalCertificatePdf] = useState(false);
  const [isViewingLatestPrescriptionFile, setIsViewingLatestPrescriptionFile] = useState(false);
  const [isPrintingPrescription, setIsPrintingPrescription] = useState(false);
  const [isSavingPrescriptionPdf, setIsSavingPrescriptionPdf] = useState(false);
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    title: string;
    html: string;
  }>({
    open: false,
    title: '',
    html: '',
  });
  const [isPrintingPreviewDocument, setIsPrintingPreviewDocument] = useState(false);
  const [isSavingPreviewDocumentPdf, setIsSavingPreviewDocumentPdf] = useState(false);
  const [expandedConsultationId, setExpandedConsultationId] = useState<string | null | undefined>(undefined);
  const [expandedPrescriptionId, setExpandedPrescriptionId] = useState<string | null | undefined>(undefined);
  const [pendingMedications, setPendingMedications] = useState<Array<{ id: string; name: string; dosage: string; instruction: string }>>([]);
  const [draftMedication, setDraftMedication] = useState({ name: '', dosage: '', instruction: '' });
  const [draftMedicationErrors, setDraftMedicationErrors] = useState({ name: '', dosage: '', instruction: '' });
  const [expandedMedicalCertificateId, setExpandedMedicalCertificateId] = useState<string | null | undefined>(undefined);
  const [expandedReferralId, setExpandedReferralId] = useState<string | null | undefined>(undefined);
  const [expandedLabOrderId, setExpandedLabOrderId] = useState<string | null | undefined>(undefined);
  const [showVitalsModal, setShowVitalsModal] = useState(false);

  const updatePatient = useUpdatePatient();
  const vitalsForm = useForm<z.infer<typeof vitalsSchema>>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: {
      temperature: patient?.temperature || '',
      bloodPressure: patient?.bloodPressure || '',
      heartRate: patient?.heartRate || '',
      respiratoryRate: patient?.respiratoryRate || '',
      weight: patient?.weight || '',
      height: patient?.height || '',
    },
  });

  // Auto-open vitals modal when navigated with ?recordVitals=1
  useEffect(() => {
    if (searchParams.get('recordVitals') === '1') {
      setShowVitalsModal(true);
    }
  }, [searchParams]);

  const pendingSpecialistReferral =
    currentDoctor
      ? referrals.find(
          (referral) =>
            referral.targetDoctorId === currentDoctor.id &&
            (referral.status === 'confirmed' || referral.status === 'accepted'),
        ) ?? null
      : null;

  const waitingFrontDeskReferral =
    currentDoctor
      ? referrals.find(
          (referral) =>
            referral.targetDoctorId === currentDoctor.id &&
            (referral.status === 'pending' || referral.status === 'sent'),
        ) ?? null
      : null;

  const frontDeskPendingReferral = referrals.find((referral) => referral.status === 'pending' || referral.status === 'sent') ?? null;
  const canConfirmReferral = profile?.role === 'front_desk_cashier' || profile?.role === 'owner_admin';

  const consultationTimeline = useMemo(
    () =>
      consultations.map((consultation) => ({
        consultation,
        appointment: visits.find((visit) => visit.id === consultation.appointmentId) ?? null,
      })),
    [consultations, visits],
  );
  const latestPrescription = useMemo(
    () =>
      prescriptions.reduce<Prescription | null>((latest, item) => {
        if (!latest) {
          return item;
        }

        return latest.createdAt >= item.createdAt ? latest : item;
      }, null),
    [prescriptions],
  );
  const latestMedicalCertificate = useMemo(
    () =>
      medicalCertificates.reduce<MedicalCertificate | null>((latest, item) => {
        if (!latest) {
          return item;
        }

        return latest.createdAt >= item.createdAt ? latest : item;
      }, null),
    [medicalCertificates],
  );

  const [activeTab, setActiveTab] = useState('overview');
  const activeConsultationId =
    expandedConsultationId === undefined
      ? (consultationTimeline[0]?.consultation.id ?? null)
      : expandedConsultationId;
  const activePrescriptionId =
    expandedPrescriptionId === undefined
      ? (prescriptions[0] ? `${prescriptions[0].consultationId}::${prescriptions[0].createdAt.substring(0, 16)}` : null)
      : expandedPrescriptionId;
  const activeMedicalCertificateId =
    expandedMedicalCertificateId === undefined
      ? (medicalCertificates[0]?.id ?? null)
      : expandedMedicalCertificateId;
  const activeReferralId =
    expandedReferralId === undefined
      ? (referrals[0]?.id ?? null)
      : expandedReferralId;
  const activeLabOrderId =
    expandedLabOrderId === undefined
      ? (filteredLabOrders[0]?.id ?? null)
      : expandedLabOrderId;

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'consultations', label: 'Consultations' },
    { id: 'prescriptions', label: 'Prescriptions' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'lab-tests', label: 'Lab Tests' },
    { id: 'referrals', label: 'Referrals' },
    { id: 'inventory', label: 'Inventory' },
  ];

  if (patientQuery.isLoading) {
    return (
      <Card>
        <div className="flex items-center gap-3 py-2">
          <div className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
          <CardTitle className="text-slate-500">Loading patient record...</CardTitle>
        </div>
      </Card>
    );
  }

  if (!patient) {
    return (
      <Card>
        <div className="py-4 text-center">
          <CardTitle className="text-slate-600">Patient not found</CardTitle>
          <p className="mt-1 text-sm text-slate-400">This patient record does not exist or may have been removed.</p>
        </div>
      </Card>
    );
  }

  const handleCreateReferral = referralForm.handleSubmit(async (values) => {
    if (!currentDoctor) return;
    const targetDoctor = providers.find((doctor) => doctor.id === values.targetDoctorId);

    await createReferral.mutateAsync({
      patientId: patient.id,
      appointmentId: visits[0]?.id ?? null,
      referringDoctorId: currentDoctor.id,
      targetDoctorId: values.targetDoctorId,
      targetSpecialtyId: targetDoctor?.specialtyId ?? null,
      reason: values.reason,
      clinicalSummary: values.clinicalSummary,
      referralNotes: values.referralNotes,
    });

    referralForm.reset({
      targetDoctorId: '',
      reason: '',
      clinicalSummary: '',
      referralNotes: '',
    });
  });

  const handleSpecialistUpdate = specialistForm.handleSubmit(async (values) => {
    if (!pendingSpecialistReferral) return;

    await updateReferralOutcome.mutateAsync({
      referralId: pendingSpecialistReferral.id,
      status: values.status,
      specialistFindings: values.specialistFindings,
      specialistRecommendations: values.specialistRecommendations,
      specialistVisitedAt: new Date(values.specialistVisitedAt).toISOString(),
    });

    specialistForm.reset({
      specialistVisitedAt: '2026-03-31T09:00',
      specialistFindings: '',
      specialistRecommendations: '',
      status: 'completed',
    });
  });

  const handleFrontDeskConfirmation = frontDeskForm.handleSubmit(async (values) => {
    if (!frontDeskPendingReferral) {
      return;
    }

    await updateReferralStatus.mutateAsync({
      referralId: frontDeskPendingReferral.id,
      status: values.status,
      referralNotes: values.referralNotes,
    });

    frontDeskForm.reset({
      status: 'confirmed',
      referralNotes: '',
    });
  });

  const handleCreatePrescription = prescriptionForm.handleSubmit(async (values) => {
    if (pendingMedications.length === 0) {
      return;
    }

    let lastCreated: typeof savedPrescription = null;
    for (const med of pendingMedications) {
      lastCreated = await createPrescription.mutateAsync({
        consultationId: values.consultationId,
        patientId: patient.id,
        prescriptionName: med.name,
        dosage: med.dosage,
        instruction: med.instruction,
      });
    }

    setSavedPrescription(lastCreated);
    setShowPrescriptionStatusModal(true);
    setPendingMedications([]);
    setDraftMedication({ name: '', dosage: '', instruction: '' });
  });

  const handleCreateMedicalCertificate = medicalCertificateForm.handleSubmit(async (values) => {
    const createdMedicalCertificate = await createMedicalCertificate.mutateAsync({
      consultationId: values.consultationId,
      patientId: patient.id,
      certificatePurpose: values.certificatePurpose,
      diagnosis: values.diagnosis,
      recommendation: values.recommendation,
      restFrom: values.restFrom || null,
      restUntil: values.restUntil || null,
    });

    setSavedMedicalCertificate(createdMedicalCertificate);
    setSavedMedicalCertificateCheckboxes({
      checkFinancial: values.checkFinancial ?? false,
      checkSchool: values.checkSchool ?? false,
      checkWork: values.checkWork ?? false,
    });
    setShowMedicalCertificateStatusModal(true);

    medicalCertificateForm.reset({
      consultationId: values.consultationId,
      certificatePurpose: '',
      diagnosis: '',
      recommendation: '',
      restFrom: '',
      restUntil: '',
      checkFinancial: false,
      checkSchool: false,
      checkWork: false,
    });
  });

  const buildPrescriptionDocumentFor = (consultationId: string | null) => {
    if (!consultationId) {
      return null;
    }

    const consultationPrescriptions = prescriptions.filter(
      (p) => p.consultationId === consultationId,
    );
    if (consultationPrescriptions.length === 0) {
      return null;
    }

    const linkedConsultation = consultations.find((consultation) => consultation.id === consultationId) ?? null;
    const linkedDoctor = linkedConsultation
      ? providers.find((provider) => provider.id === linkedConsultation.doctorId) ?? null
      : null;
    const nextAppointment = linkedConsultation
      ? `${linkedConsultation.consultationDate} ${linkedConsultation.consultationTime}`
      : '________________';
    const doctorNameRaw = linkedDoctor?.fullName ?? linkedConsultation?.providerName ?? currentDoctor?.fullName ?? profile?.fullName ?? 'Attending Physician';
    const doctorPostNominals = linkedDoctor?.title ?? currentDoctor?.title ?? profile?.title ?? '';
    const doctorName = formatDoctorDisplayName(doctorNameRaw, doctorPostNominals);
    const doctorSpecialty = linkedDoctor?.specialtyName ?? currentDoctor?.specialtyName ?? 'Physician';
    const doctorLicenseNumber = linkedDoctor?.licenseNumber ?? currentDoctor?.licenseNumber ?? '';
    const doctorBirNumber = linkedDoctor?.birNumber ?? currentDoctor?.birNumber ?? '';
    const doctorPtrNumber = linkedDoctor?.ptrNumber ?? currentDoctor?.ptrNumber ?? '';

    const patientAge = patient.birthDate
      ? String(new Date().getFullYear() - new Date(patient.birthDate).getFullYear() - (
          new Date() < new Date(new Date(patient.birthDate).setFullYear(new Date().getFullYear())) ? 1 : 0
        ))
      : '';
    const patientSex = patient.sex === 'male' ? 'Male' : patient.sex === 'female' ? 'Female' : 'Other';

    return buildSavedPrescriptionDocument({
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientAge,
      patientSex,
      patientAddress: patient.address ?? '',
      doctorName,
      doctorSpecialty,
      doctorLicenseNumber,
      doctorBirNumber,
      doctorPtrNumber,
      doctorPrcQrData: buildDoctorPrcResultQrData({
        doctorName,
        doctorSpecialty,
        doctorLicenseNumber,
        doctorBirNumber,
        doctorPtrNumber,
      }),
      clinicName: clinicSettings?.clinicName ?? 'Clinic',
      clinicAddress: clinicSettings?.address ?? 'Address not configured',
      clinicContactNumber: clinicSettings?.contactNumber ?? 'Contact not configured',
      clinicEmail: clinicSettings?.email ?? 'Email not configured',
      prescriptions: consultationPrescriptions,
      issuedDate: consultationPrescriptions[0].createdAt,
      nextAppointment,
    });
  };

  const buildMedicalCertificateDocumentFor = (medicalCertificate: MedicalCertificate | null, checkboxes = savedMedicalCertificateCheckboxes) => {
    if (!medicalCertificate) {
      return null;
    }

    const linkedConsultation = consultations.find((consultation) => consultation.id === medicalCertificate.consultationId) ?? null;
    const linkedDoctor = linkedConsultation
      ? providers.find((provider) => provider.id === linkedConsultation.doctorId) ?? null
      : null;
    const doctorNameRaw = linkedDoctor?.fullName ?? linkedConsultation?.providerName ?? currentDoctor?.fullName ?? profile?.fullName ?? 'Attending Physician';
    const doctorPostNominals = linkedDoctor?.title ?? currentDoctor?.title ?? profile?.title ?? '';
    const doctorName = formatDoctorDisplayName(doctorNameRaw, doctorPostNominals);
    const doctorSpecialty = linkedDoctor?.specialtyName ?? currentDoctor?.specialtyName ?? 'Physician';
    const doctorLicenseNumber = linkedDoctor?.licenseNumber ?? currentDoctor?.licenseNumber ?? '';
    const doctorBirNumber = linkedDoctor?.birNumber ?? currentDoctor?.birNumber ?? '';
    const doctorPtrNumber = linkedDoctor?.ptrNumber ?? currentDoctor?.ptrNumber ?? '';

    const patientAge = patient.birthDate
      ? String(new Date().getFullYear() - new Date(patient.birthDate).getFullYear() - (
          new Date() < new Date(new Date(patient.birthDate).setFullYear(new Date().getFullYear())) ? 1 : 0
        ))
      : '';
    const patientSex = patient.sex === 'male' ? 'Male' : patient.sex === 'female' ? 'Female' : 'Other';

    return buildSavedMedicalCertificateDocument({
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientAge,
      patientSex,
      patientAddress: patient.address ?? '',
      doctorName,
      doctorSpecialty,
      doctorLicenseNumber,
      doctorBirNumber,
      doctorPtrNumber,
      doctorPrcQrData: buildDoctorPrcResultQrData({
        doctorName,
        doctorSpecialty,
        doctorLicenseNumber,
        doctorBirNumber,
        doctorPtrNumber,
      }),
      clinicName: clinicSettings?.clinicName ?? 'Clinic',
      clinicAddress: clinicSettings?.address ?? 'Address not configured',
      clinicContactNumber: clinicSettings?.contactNumber ?? 'Contact not configured',
      clinicEmail: clinicSettings?.email ?? 'Email not configured',
      medicalCertificate,
      checkFinancial: checkboxes.checkFinancial,
      checkSchool: checkboxes.checkSchool,
      checkWork: checkboxes.checkWork,
    });
  };

  const getSavedPrescriptionDocument = () => buildPrescriptionDocumentFor(savedPrescription?.consultationId ?? null);

  const getSavedMedicalCertificateDocument = () => buildMedicalCertificateDocumentFor(savedMedicalCertificate);

  const openDocumentPreviewInModal = (documentHtml: string, title: string) => {
    setPreviewModal({
      open: true,
      title,
      html: documentHtml,
    });
  };

  const handlePrintPreviewDocument = async () => {
    if (!previewModal.html) {
      toast.error('No document is loaded in preview.');
      return;
    }

    setIsPrintingPreviewDocument(true);
    try {
      await printHtmlDocument(previewModal.html);
    } catch {
      toast.error('The document could not be sent to the printer.');
    } finally {
      setIsPrintingPreviewDocument(false);
    }
  };

  const handleSavePreviewDocumentAsPdf = async () => {
    if (!previewModal.html) {
      toast.error('No document is loaded in preview.');
      return;
    }

    setIsSavingPreviewDocumentPdf(true);
    toast.message('When the print dialog opens, choose "Save as PDF" as the destination.');
    try {
      await printHtmlDocument(previewModal.html);
    } catch {
      toast.error('The document could not be prepared for PDF export.');
    } finally {
      setIsSavingPreviewDocumentPdf(false);
    }
  };

  const handlePrintSavedPrescription = async () => {
    const documentHtml = getSavedPrescriptionDocument();
    if (!documentHtml) {
      toast.error('Save a prescription first before printing.');
      return;
    }

    setIsPrintingPrescription(true);
    try {
      await printHtmlDocument(documentHtml);
    } catch {
      toast.error('The prescription could not be sent to the printer.');
    } finally {
      setIsPrintingPrescription(false);
    }
  };

  const handleViewLatestPrescriptionFile = () => {
    const documentHtml = getSavedPrescriptionDocument();
    if (!documentHtml) {
      toast.error('Save a prescription first before viewing the latest file.');
      return;
    }

    setIsViewingLatestPrescriptionFile(true);
    try {
      openDocumentPreviewInModal(documentHtml, 'Latest prescription');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open the latest prescription file.');
    } finally {
      setIsViewingLatestPrescriptionFile(false);
    }
  };

  const handleViewLatestPrescriptionFromChart = () => {
    const consultationId = latestPrescription?.consultationId ?? null;
    const documentHtml = buildPrescriptionDocumentFor(consultationId);
    if (!documentHtml) {
      toast.error('No prescription is available yet for this patient.');
      return;
    }

    setSavedPrescription(latestPrescription);
    setIsViewingLatestPrescriptionFile(true);
    try {
      openDocumentPreviewInModal(documentHtml, 'Latest prescription');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open the latest prescription file.');
    } finally {
      setIsViewingLatestPrescriptionFile(false);
    }
  };

  const handleViewPrescriptionFromHistory = (prescription: Prescription) => {
    const documentHtml = buildPrescriptionDocumentFor(prescription.consultationId);
    if (!documentHtml) {
      toast.error('Unable to open this prescription file.');
      return;
    }

    setSavedPrescription(prescription);
    setIsViewingLatestPrescriptionFile(true);
    try {
      openDocumentPreviewInModal(documentHtml, `${prescription.prescriptionName} prescription`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open this prescription file.');
    } finally {
      setIsViewingLatestPrescriptionFile(false);
    }
  };

  const handleSavePrescriptionAsPdf = async () => {
    const documentHtml = getSavedPrescriptionDocument();
    if (!documentHtml) {
      toast.error('Save a prescription first before exporting as PDF.');
      return;
    }

    setIsSavingPrescriptionPdf(true);
    toast.message('When the print dialog opens, choose "Save as PDF" as the destination.');
    try {
      await printHtmlDocument(documentHtml);
    } catch {
      toast.error('The prescription could not be prepared for PDF export.');
    } finally {
      setIsSavingPrescriptionPdf(false);
    }
  };

  const handlePrintSavedMedicalCertificate = async () => {
    const documentHtml = getSavedMedicalCertificateDocument();
    if (!documentHtml) {
      toast.error('Save a medical certificate first before printing.');
      return;
    }

    setIsPrintingMedicalCertificate(true);
    try {
      await printHtmlDocument(documentHtml);
    } catch {
      toast.error('The medical certificate could not be sent to the printer.');
    } finally {
      setIsPrintingMedicalCertificate(false);
    }
  };

  const handleViewLatestMedicalCertificateFile = () => {
    const documentHtml = getSavedMedicalCertificateDocument();
    if (!documentHtml) {
      toast.error('Save a medical certificate first before viewing the latest file.');
      return;
    }

    setIsViewingLatestMedicalCertificateFile(true);
    try {
      openDocumentPreviewInModal(documentHtml, 'Latest medical certificate');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open the latest medical certificate file.');
    } finally {
      setIsViewingLatestMedicalCertificateFile(false);
    }
  };

  const handleViewLatestMedicalCertificateFromChart = () => {
    const documentHtml = buildMedicalCertificateDocumentFor(latestMedicalCertificate);
    if (!documentHtml) {
      toast.error('No medical certificate is available yet for this patient.');
      return;
    }

    setSavedMedicalCertificate(latestMedicalCertificate);
    setIsViewingLatestMedicalCertificateFile(true);
    try {
      openDocumentPreviewInModal(documentHtml, 'Latest medical certificate');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open the latest medical certificate file.');
    } finally {
      setIsViewingLatestMedicalCertificateFile(false);
    }
  };

  const handleViewMedicalCertificateFromHistory = (medicalCertificate: MedicalCertificate) => {
    const documentHtml = buildMedicalCertificateDocumentFor(medicalCertificate);
    if (!documentHtml) {
      toast.error('Unable to open this medical certificate file.');
      return;
    }

    setSavedMedicalCertificate(medicalCertificate);
    setIsViewingLatestMedicalCertificateFile(true);
    try {
      openDocumentPreviewInModal(documentHtml, `${medicalCertificate.certificatePurpose} certificate`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open this medical certificate file.');
    } finally {
      setIsViewingLatestMedicalCertificateFile(false);
    }
  };

  const handleSaveMedicalCertificateAsPdf = async () => {
    const documentHtml = getSavedMedicalCertificateDocument();
    if (!documentHtml) {
      toast.error('Save a medical certificate first before exporting as PDF.');
      return;
    }

    setIsSavingMedicalCertificatePdf(true);
    toast.message('When the print dialog opens, choose "Save as PDF" as the destination.');
    try {
      await printHtmlDocument(documentHtml);
    } catch {
      toast.error('The medical certificate could not be prepared for PDF export.');
    } finally {
      setIsSavingMedicalCertificatePdf(false);
    }
  };

  const handleRecordInventoryUsage = inventoryUsageForm.handleSubmit(async (values) => {
    const normalizedCode = extractInventoryItemQrCode(values.scannedCode);
    const item = database.inventoryItems.find((inventoryItem) => inventoryItem.qrCode === normalizedCode);

    if (!item) {
      toast.error('That QR code is not linked to an inventory item yet.');
      return;
    }

    try {
      await recordInventoryUsage.mutateAsync({
        patientId: patient.id,
        itemId: item.id,
        appointmentId: values.appointmentId || null,
        quantity: values.quantity,
        notes: values.notes,
        scannedCode: normalizedCode,
        recordedBy: profile?.id ?? 'user_owner',
      });

      toast.success(`${item.name} recorded for ${patient.firstName}.`);
      inventoryUsageForm.reset({
        scannedCode: '',
        appointmentId: values.appointmentId ?? '',
        quantity: 1,
        notes: '',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to record inventory usage.');
    }
  });

  return (
    <div className="space-y-4">
      {previewModal.open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-3"
          onClick={() => setPreviewModal({ open: false, title: '', html: '' })}
          role="dialog"
        >
          <div
            className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-bold uppercase tracking-wider text-slate-700">{previewModal.title}</p>
              <div className="flex items-center gap-2">
                <Button
                  className="rounded-xl"
                  disabled={isPrintingPreviewDocument || isSavingPreviewDocumentPdf}
                  onClick={() => {
                    void handlePrintPreviewDocument();
                  }}
                  type="button"
                  variant="secondary"
                >
                  {isPrintingPreviewDocument ? 'Printing...' : 'Print'}
                </Button>
                <Button
                  className="rounded-xl"
                  disabled={isPrintingPreviewDocument || isSavingPreviewDocumentPdf}
                  onClick={() => {
                    void handleSavePreviewDocumentAsPdf();
                  }}
                  type="button"
                  variant="secondary"
                >
                  {isSavingPreviewDocumentPdf ? 'Opening PDF...' : 'Save as PDF'}
                </Button>
                <button
                  aria-label="Close preview modal"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 p-2 text-slate-700 transition hover:bg-slate-100"
                  onClick={() => setPreviewModal({ open: false, title: '', html: '' })}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <iframe
              className="h-full w-full"
              srcDoc={previewModal.html}
              title={previewModal.title || 'Document preview'}
            />
          </div>
        </div>
      ) : null}

      <DocumentStatusModal
        eyebrowLabel="Prescription saved"
        isViewingLatestFile={isViewingLatestPrescriptionFile}
        isPrinting={isPrintingPrescription}
        isSavingPdf={isSavingPrescriptionPdf}
        message="Prescription details were saved successfully. You can now print the prescription or save it as a PDF."
        onClose={() => setShowPrescriptionStatusModal(false)}
        onViewLatestFile={handleViewLatestPrescriptionFile}
        onPrint={() => {
          void handlePrintSavedPrescription();
        }}
        onSavePdf={() => {
          void handleSavePrescriptionAsPdf();
        }}
        open={showPrescriptionStatusModal}
        title="Prescription ready for printing"
      />

      <DocumentStatusModal
        eyebrowLabel="Medical certificate saved"
        isViewingLatestFile={isViewingLatestMedicalCertificateFile}
        isPrinting={isPrintingMedicalCertificate}
        isSavingPdf={isSavingMedicalCertificatePdf}
        message="Medical certificate details were saved successfully. You can now review, print, or save the document as a PDF."
        onClose={() => setShowMedicalCertificateStatusModal(false)}
        onPrint={() => {
          void handlePrintSavedMedicalCertificate();
        }}
        onSavePdf={() => {
          void handleSaveMedicalCertificateAsPdf();
        }}
        onViewLatestFile={handleViewLatestMedicalCertificateFile}
        open={showMedicalCertificateStatusModal}
        title="Medical certificate ready for printing"
      />

      {openedFromQr ? (
        <Card className="border-emerald-100 bg-emerald-50/80">
          <p className="text-sm font-medium text-emerald-700">Patient record opened from QR scan.</p>
          <p className="mt-1 text-sm text-emerald-900">You can continue directly to consultation entry from the button below.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
        <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-lg font-bold text-white shadow-sm">
              {patient.firstName[0]}{patient.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Patient chart</p>
              <CardTitle className="mt-1 text-3xl">
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                <span>{patient.email}</span>
                <span className="text-slate-300">|</span>
                <span>{patient.mobileNumber}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                QR: <span className="font-mono font-semibold text-slate-700">{patient.qrCode}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canClinicalActions ? (
                <Link
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-sm transition hover:opacity-90 active:scale-95"
                  to={`/app/consultation/${patient.id}`}
                >
                  Start Consultation
                </Link>
              ) : null}
              <button
                onClick={() => setShowVitalsModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-sm transition hover:opacity-90 active:scale-95"
              >
                <Activity className="size-4" />
                Record Vitals
              </button>
              <Badge>{patient.bloodType || 'Blood type pending'}</Badge>
              <Badge intent="warning">{patient.allergies}</Badge>
            </div>
          </div>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-sky-300 bg-sky-100">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-sky-200 p-2">
                <FileText className="size-4 text-sky-700" />
              </div>
              <CardTitle className="text-base">Consultations</CardTitle>
            </div>
            <p className="mt-3 text-3xl font-bold text-sky-950">{consultations.length}</p>
          </Card>
          <Card className="border-emerald-300 bg-emerald-100">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-200 p-2">
                <Pill className="size-4 text-emerald-700" />
              </div>
              <CardTitle className="text-base">Prescriptions</CardTitle>
            </div>
            <p className="mt-3 text-3xl font-bold text-emerald-950">{prescriptions.length}</p>
          </Card>
          <Card className="border-amber-300 bg-amber-100">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-200 p-2">
                <QrCode className="size-4 text-amber-700" />
              </div>
              <CardTitle className="text-base">Items used</CardTitle>
            </div>
            <p className="mt-3 text-3xl font-bold text-amber-950">{inventoryUsageLogs.length}</p>
          </Card>
          <Card className="border-violet-300 bg-violet-100">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-200 p-2">
                <TestTubeDiagonal className="size-4 text-violet-700" />
              </div>
              <CardTitle className="text-base">Lab orders</CardTitle>
            </div>
            <p className="mt-3 text-3xl font-bold text-violet-950">{labOrders.length}</p>
          </Card>
        </div>
        </div>

        <PatientQrCard patientName={`${patient.firstName} ${patient.lastName}`} qrCode={patient.qrCode} />
      </div>

      <div className="mt-4 flex overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset ${
              activeTab === tab.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
          <Card>
            <CardTitle>Clinical overview</CardTitle>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Birth date</p>
                <p className="mt-1 font-semibold text-slate-900">{formatDateLabel(patient.birthDate)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Blood type</p>
                <p className="mt-1 font-semibold text-slate-900">{formatConsultationText(patient.bloodType)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Allergies</p>
                <p className="mt-1 font-semibold text-slate-900">{formatConsultationText(patient.allergies)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Emergency contact</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatConsultationText(patient.emergencyContactName)} | {formatConsultationText(patient.emergencyContactPhone)}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Medical history</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {formatConsultationText(patient.medicalHistory)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Address</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {formatConsultationText(patient.address)}
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Visit timeline</CardTitle>
                <Badge intent="info">{visits.length} visit{visits.length !== 1 ? 's' : ''}</Badge>
              </div>
              <div className="mt-5 space-y-3">
                {visits.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-500">No visits yet</p>
                    <p className="mt-1 text-xs text-slate-400">Appointment history will appear here once recorded.</p>
                  </div>
                ) : (
                  visits.map((visit) => (
                    <div key={visit.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-slate-950">{formatDateTimeLabel(visit.scheduledAt)}</p>
                        <Badge intent={consultationAppointmentIds.has(visit.id) ? 'info' : 'warning'}>
                          {consultationAppointmentIds.has(visit.id) ? 'SOAP saved' : 'SOAP pending'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Reason for visit</p>
                      <p className="mt-1 text-sm text-slate-700">{formatConsultationText(visit.reason)}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>

          </div>
        </div>
      )}

      {activeTab === 'consultations' && (
        <div className="mt-6">
          <Card>
          <CardTitle>SOAP notes</CardTitle>
          <div className="mt-5 space-y-4">
            {consultationTimeline.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                <p className="text-sm font-semibold text-slate-500">No SOAP notes yet</p>
                <p className="mt-1 text-xs text-slate-400">Consultation notes will appear here once a session is documented.</p>
              </div>
            ) : (
              consultationTimeline.map(({ consultation, appointment }) => {
                const isExpanded = activeConsultationId === consultation.id;
                const trayContentId = `consultation-tray-${consultation.id}`;
                const consultationVitalsText =
                  consultation.vitals?.trim() ||
                  buildPatientVitalsText(patient) ||
                  'Not provided';

                return (
                <div
                  key={consultation.id}
                  className={`group rounded-3xl border p-4 transition-all ${
                    isExpanded
                      ? 'border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <button
                    aria-controls={trayContentId}
                    aria-expanded={isExpanded}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                    onClick={() =>
                      setExpandedConsultationId((current) =>
                        (current === undefined ? consultationTimeline[0]?.consultation.id ?? null : current) === consultation.id
                          ? null
                          : consultation.id,
                      )
                    }
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950">
                        {appointment ? formatDateTimeLabel(appointment.scheduledAt) : 'Consultation note'}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {formatConsultationText(consultation.providerName)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                        <span className="font-semibold text-slate-800">Diagnosis:</span> {truncateText(consultation.diagnosis, 140)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge intent="info">{isExpanded ? 'Expanded' : 'SOAP completed'}</Badge>
                      <span
                        className={`rounded-full p-1.5 transition-colors ${
                          isExpanded ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}
                      >
                        <ChevronDown
                          className={`size-4 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="mt-4 space-y-4 border-t border-sky-100 pt-4" id={trayContentId}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Consultation Type</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {formatConsultationText(consultation.consultationType)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Diagnosis</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">
                            {formatConsultationText(consultation.diagnosis)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Clinical Summary</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                          {formatConsultationText(consultation.clinicalSummary)}
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Present Illness History</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatConsultationText(consultation.presentIllnessHistory)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Review of Symptoms</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatConsultationText(consultation.reviewOfSymptoms)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Allergies</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatConsultationText(consultation.allergies)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Vitals</p>
                          <div className="mt-3">
                            {(() => {
                              const vitals = parseVitalsFromText(consultationVitalsText);
                              const hasAnyVitals = Object.values(vitals).some(v => v && v !== 'Not provided');
                              
                              if (!hasAnyVitals) {
                                return <p className="text-sm text-slate-600">Not provided</p>;
                              }
                              
                              return (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {vitals.temperature && (
                                    <div className="text-sm">
                                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Temperature</p>
                                      <p className="mt-0.5 font-semibold text-slate-900">{vitals.temperature} °C</p>
                                    </div>
                                  )}
                                  {vitals.bloodPressure && (
                                    <div className="text-sm">
                                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Blood Pressure</p>
                                      <p className="mt-0.5 font-semibold text-slate-900">{vitals.bloodPressure} mmHg</p>
                                    </div>
                                  )}
                                  {vitals.heartRate && (
                                    <div className="text-sm">
                                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Heart Rate</p>
                                      <p className="mt-0.5 font-semibold text-slate-900">{vitals.heartRate} bpm</p>
                                    </div>
                                  )}
                                  {vitals.respiratoryRate && (
                                    <div className="text-sm">
                                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Respiratory Rate</p>
                                      <p className="mt-0.5 font-semibold text-slate-900">{vitals.respiratoryRate} breaths/min</p>
                                    </div>
                                  )}
                                  {vitals.weight && (
                                    <div className="text-sm">
                                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Weight</p>
                                      <p className="mt-0.5 font-semibold text-slate-900">{vitals.weight} kg</p>
                                    </div>
                                  )}
                                  {vitals.height && (
                                    <div className="text-sm">
                                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Height</p>
                                      <p className="mt-0.5 font-semibold text-slate-900">{vitals.height} cm</p>
                                    </div>
                                  )}
                                  {vitals.vitalsRecordedAt && (
                                    <div className="col-span-full text-sm">
                                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Recorded at Intake</p>
                                      <p className="mt-0.5 text-slate-600">{vitals.vitalsRecordedAt}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Lab Results</p>
                        <div className="mt-2">
                          <LabResultsDisplay value={consultation.labResults} />
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">SOAP Breakdown</p>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Subjective</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                              {formatConsultationText(consultation.subjective)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Objective</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                              {formatConsultationText(consultation.objective)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Assessment</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                              {formatConsultationText(consultation.assessment)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Plan</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                              {formatConsultationText(consultation.plan)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Treatment Plan</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatConsultationText(consultation.treatmentPlan)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Medications</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatConsultationText(consultation.medications)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Differential Diagnosis</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatConsultationText(consultation.differentialDiagnosis)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Outcome</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatConsultationText(consultation.outcome)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Quick preview</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {truncateText(consultation.clinicalSummary || consultation.subjective, 180)}
                      </p>
                    </div>
                  )}
                </div>
              );
              })
            )}
          </div>
          </Card>
        </div>
      )}

      {activeTab === 'prescriptions' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Prescription history</CardTitle>
              <Button
                className="gap-2 rounded-xl"
                disabled={isViewingLatestPrescriptionFile || prescriptions.length === 0}
                onClick={handleViewLatestPrescriptionFromChart}
                type="button"
                variant="secondary"
              >
                <Eye className="size-4" />
                {isViewingLatestPrescriptionFile ? 'Opening latest file...' : 'View Latest Prescription'}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {prescriptions.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-500">No prescriptions yet</p>
                  <p className="mt-1 text-xs text-slate-400">Prescriptions linked to consultations will appear here.</p>
                </div>
              ) : (
                Array.from(
                  prescriptions.reduce((map, p) => {
                    const key = `${p.consultationId}::${p.createdAt.substring(0, 16)}`;
                    if (!map.has(key)) map.set(key, []);
                    map.get(key)!.push(p);
                    return map;
                  }, new Map<string, typeof prescriptions>()),
                ).map(([batchKey, group]) => {
                  const consultationId = batchKey.split('::')[0];
                  const linkedConsultation = consultations.find((c) => c.id === consultationId);
                  const isExpanded = activePrescriptionId === batchKey;
                  const trayContentId = `prescription-tray-${batchKey.replace(/[^a-z0-9]/gi, '-')}`;
                  const firstPrescription = group[0];
                  const dateLabel = linkedConsultation
                    ? `${linkedConsultation.consultationDate} ${linkedConsultation.consultationTime}`
                    : formatDateTimeLabel(firstPrescription.createdAt);
                  return (
                    <div
                      key={batchKey}
                      className={`rounded-xl border transition-all ${
                        isExpanded ? 'border-sky-200 bg-sky-50/40' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Tray header row */}
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          aria-controls={trayContentId}
                          aria-expanded={isExpanded}
                          className="group flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
                          onClick={() =>
                            setExpandedPrescriptionId((current) => {
                              const defaultKey = prescriptions[0]
                                ? `${prescriptions[0].consultationId}::${prescriptions[0].createdAt.substring(0, 16)}`
                                : null;
                              return (current === undefined ? defaultKey : current) === batchKey ? null : batchKey;
                            })
                          }
                          type="button"
                        >
                          <span className={`flex-shrink-0 rounded-full p-0.5 transition-colors ${isExpanded ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                            <ChevronDown className={`size-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">
                              {group.length > 1
                                ? `${group.map((p) => p.prescriptionName).join(', ')}`
                                : firstPrescription.prescriptionName}
                            </span>
                            <span className="block text-xs text-slate-400">{dateLabel}</span>
                          </span>
                          {group.length > 1 && (
                            <span className="flex-shrink-0 rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                              {group.length} meds
                            </span>
                          )}
                        </button>
                        <Button
                          className="h-7 flex-shrink-0 rounded-lg px-2 text-xs"
                          disabled={isViewingLatestPrescriptionFile}
                          onClick={() => handleViewPrescriptionFromHistory(firstPrescription)}
                          type="button"
                          variant="secondary"
                        >
                          <Eye className="mr-1 size-3" />
                          Print
                        </Button>
                      </div>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div className="border-t border-sky-100 px-3 pb-3 pt-2" id={trayContentId}>
                          {group.map((prescription, index) => (
                            <div key={prescription.id}>
                              {index > 0 && <hr className="my-2 border-slate-100" />}
                              <div className="flex items-baseline gap-1.5">
                                {group.length > 1 && (
                                  <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-sky-500">#{index + 1}</span>
                                )}
                                <span className="text-sm font-semibold text-slate-900">{prescription.prescriptionName}</span>
                                <span className="text-xs text-slate-400">— {prescription.dosage}</span>
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">
                                <span className="font-medium text-slate-600">Sig.</span> {prescription.instruction}
                              </p>
                            </div>
                          ))}
                          <p className="mt-2 text-[10px] text-slate-400">Issued {formatDateTimeLabel(firstPrescription.createdAt)}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
          <div className="space-y-6">
            {canDoctorActions ? (
            <Card>
              <CardTitle>Prescription details</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                Select a consultation, add one or more medications to the list, then save all at once.
              </p>
              <form className="mt-5 space-y-4" onSubmit={handleCreatePrescription}>
                <FormField error={prescriptionForm.formState.errors.consultationId?.message} label="Consultation record">
                  <Select {...prescriptionForm.register('consultationId')}>
                    <option value="">Select consultation</option>
                    {consultations.map((consultation) => (
                      <option key={consultation.id} value={consultation.id}>
                        {consultation.consultationDate} {consultation.consultationTime} - {consultation.diagnosis}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Medications</span>
                  </div>

                  {pendingMedications.map((med, index) => (
                    <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3" key={med.id}>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-sky-600">#{index + 1}</p>
                        <p className="text-sm font-semibold text-slate-900">{med.name}</p>
                        <p className="text-xs text-slate-500">{med.dosage}</p>
                        <p className="text-xs text-slate-500 italic">{med.instruction}</p>
                      </div>
                      <button
                        className="mt-0.5 shrink-0 text-slate-400 hover:text-red-500"
                        onClick={() => setPendingMedications((prev) => prev.filter((m) => m.id !== med.id))}
                        type="button"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}

                  <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">New medication</p>
                    <FormField error={draftMedicationErrors.name} label="Medication name">
                      <Input
                        onChange={(e) => setDraftMedication((prev) => ({ ...prev, name: e.target.value }))}
                        value={draftMedication.name}
                      />
                    </FormField>
                    <FormField error={draftMedicationErrors.dosage} label="Dosage">
                      <Input
                        onChange={(e) => setDraftMedication((prev) => ({ ...prev, dosage: e.target.value }))}
                        value={draftMedication.dosage}
                      />
                    </FormField>
                    <FormField error={draftMedicationErrors.instruction} label="Instruction (Sig.)">
                      <Textarea
                        onChange={(e) => setDraftMedication((prev) => ({ ...prev, instruction: e.target.value }))}
                        rows={2}
                        value={draftMedication.instruction}
                      />
                    </FormField>
                    <button
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-white py-2 text-sm font-semibold text-sky-600 hover:bg-sky-50"
                      onClick={() => {
                        const errors = {
                          name: draftMedication.name.trim().length < 2 ? 'Medication name is required.' : '',
                          dosage: draftMedication.dosage.trim().length < 2 ? 'Dosage is required.' : '',
                          instruction: draftMedication.instruction.trim().length < 2 ? 'Instruction is required.' : '',
                        };
                        setDraftMedicationErrors(errors);
                        if (errors.name || errors.dosage || errors.instruction) return;
                        setPendingMedications((prev) => [
                          ...prev,
                          { id: crypto.randomUUID(), ...draftMedication },
                        ]);
                        setDraftMedication({ name: '', dosage: '', instruction: '' });
                        setDraftMedicationErrors({ name: '', dosage: '', instruction: '' });
                      }}
                      type="button"
                    >
                      <Plus className="size-4" />
                      Add to list
                    </button>
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={createPrescription.isPending || pendingMedications.length === 0}
                  type="submit"
                >
                  {createPrescription.isPending
                    ? 'Saving...'
                    : pendingMedications.length === 0
                      ? 'Add at least one medication'
                      : `Save ${pendingMedications.length} medication${pendingMedications.length > 1 ? 's' : ''}`}
                </Button>
              </form>
            </Card>
          ) : null}
          </div>
        </div>
      )}

      {activeTab === 'certificates' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Medical certificate history</CardTitle>
              <Button
                className="gap-2 rounded-xl"
                disabled={isViewingLatestMedicalCertificateFile || medicalCertificates.length === 0}
                onClick={handleViewLatestMedicalCertificateFromChart}
                type="button"
                variant="secondary"
              >
                <Eye className="size-4" />
                {isViewingLatestMedicalCertificateFile ? 'Opening latest file...' : 'View Latest Medical Certificate'}
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              {medicalCertificates.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-500">No certificates yet</p>
                  <p className="mt-1 text-xs text-slate-400">Medical certificates issued to this patient will appear here.</p>
                </div>
              ) : (
                medicalCertificates.map((medicalCertificate) => {
                  const linkedConsultation = consultations.find((consultation) => consultation.id === medicalCertificate.consultationId);
                  const isExpanded = activeMedicalCertificateId === medicalCertificate.id;
                  const trayContentId = `certificate-tray-${medicalCertificate.id}`;
                  return (
                    <div
                      key={medicalCertificate.id}
                      className={`rounded-3xl border p-4 transition-all ${
                        isExpanded ? 'border-emerald-200 bg-emerald-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          aria-controls={trayContentId}
                          aria-expanded={isExpanded}
                          className="group min-w-0 flex-1 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                          onClick={() =>
                            setExpandedMedicalCertificateId((current) =>
                              (current === undefined ? medicalCertificates[0]?.id ?? null : current) === medicalCertificate.id
                                ? null
                                : medicalCertificate.id,
                            )
                          }
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Certificate Purpose</p>
                              <p className="font-semibold text-slate-950">{medicalCertificate.certificatePurpose}</p>
                              <p className="text-sm text-slate-500">
                                {linkedConsultation ? `${linkedConsultation.consultationDate} ${linkedConsultation.consultationTime}` : 'Certificate saved'}
                              </p>
                            </div>
                            <span
                              className={`rounded-full p-1.5 transition-colors ${
                                isExpanded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                              }`}
                            >
                              <ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </span>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <Badge intent="info">{isExpanded ? 'Expanded' : 'Saved'}</Badge>
                          <Button
                            className="h-8 rounded-lg px-3"
                            disabled={isViewingLatestMedicalCertificateFile}
                            onClick={() => handleViewMedicalCertificateFromHistory(medicalCertificate)}
                            type="button"
                            variant="secondary"
                          >
                            <Eye className="mr-1.5 size-3.5" />
                            View
                          </Button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="mt-4 space-y-3 border-t border-emerald-100 pt-4" id={trayContentId}>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Diagnosis</p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                                {formatConsultationText(medicalCertificate.diagnosis)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Issued</p>
                              <p className="mt-1 text-sm text-slate-700">{formatDateTimeLabel(medicalCertificate.createdAt)}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Recommendation</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                              {formatConsultationText(medicalCertificate.recommendation)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Rest Period</p>
                            <p className="mt-1 text-sm text-slate-700">
                              {(medicalCertificate.restFrom || 'Start not set')} to {(medicalCertificate.restUntil || 'End not set')}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          {truncateText(medicalCertificate.recommendation, 120)}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
          <div className="space-y-6">
            {canDoctorActions ? (
            <Card>
              <CardTitle>Medical certificate details</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                Create an official medical certificate linked to an existing consultation entry for this patient.
              </p>
              <div className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Patient name, age, sex, and address are automatically pulled from the patient's profile and will appear on the printed certificate.
              </div>
              <form className="mt-5 space-y-4" onSubmit={handleCreateMedicalCertificate}>
                <FormField error={medicalCertificateForm.formState.errors.consultationId?.message} label="Consultation record">
                  <Select {...medicalCertificateForm.register('consultationId')}>
                    <option value="">Select consultation</option>
                    {consultations.map((consultation) => (
                      <option key={consultation.id} value={consultation.id}>
                        {consultation.consultationDate} {consultation.consultationTime} - {consultation.diagnosis}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField error={medicalCertificateForm.formState.errors.certificatePurpose?.message} label="Certificate purpose">
                  <Input placeholder="Example: Sick leave, school absence, fit-to-work review" {...medicalCertificateForm.register('certificatePurpose')} />
                </FormField>
                <FormField error={medicalCertificateForm.formState.errors.diagnosis?.message} label="Diagnosis / clinical impression">
                  <Textarea rows={3} {...medicalCertificateForm.register('diagnosis')} />
                </FormField>
                <FormField error={medicalCertificateForm.formState.errors.recommendation?.message} label="Recommendation">
                  <Textarea rows={3} {...medicalCertificateForm.register('recommendation')} />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Rest from">
                    <Input type="date" {...medicalCertificateForm.register('restFrom')} />
                  </FormField>
                  <FormField label="Rest until">
                    <Input type="date" {...medicalCertificateForm.register('restUntil')} />
                  </FormField>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Certificate issued for</p>
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input className="h-4 w-4 rounded border-slate-300" type="checkbox" {...medicalCertificateForm.register('checkFinancial')} />
                      <span className="text-sm text-slate-700">Financial and Medical assistance program</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input className="h-4 w-4 rounded border-slate-300" type="checkbox" {...medicalCertificateForm.register('checkSchool')} />
                      <span className="text-sm text-slate-700">School related purpose</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input className="h-4 w-4 rounded border-slate-300" type="checkbox" {...medicalCertificateForm.register('checkWork')} />
                      <span className="text-sm text-slate-700">Work related purpose</span>
                    </label>
                  </div>
                </div>
                <Button className="w-full" disabled={createMedicalCertificate.isPending} type="submit">
                  {createMedicalCertificate.isPending ? 'Saving certificate...' : 'Save medical certificate'}
                </Button>
              </form>
            </Card>
          ) : null}
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <Card>
            <CardTitle>Inventory usage history</CardTitle>
            <div className="mt-5 space-y-4">
              {inventoryUsageLogs.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-500">No items recorded yet</p>
                  <p className="mt-1 text-xs text-slate-400">Medicines and supplies dispensed to this patient will appear here.</p>
                </div>
              ) : (
                inventoryUsageLogs.map((log) => {
                  const item = database.inventoryItems.find((inventoryItem) => inventoryItem.id === log.itemId);
                  const linkedVisit = visits.find((visit) => visit.id === log.appointmentId);

                  return (
                    <div key={log.id} className="rounded-3xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">{item?.name ?? 'Inventory item removed'}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {log.quantity} {item?.unit ?? 'unit'} used
                            {linkedVisit ? ` during ${formatDateTimeLabel(linkedVisit.scheduledAt)}` : ''}
                          </p>
                        </div>
                        <Badge intent="info">{formatDateTimeLabel(log.createdAt)}</Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-700">{log.notes}</p>
                      <p className="mt-3 break-all font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
                        Scanned code {log.scannedCode}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
          <div className="space-y-6">
            {canInventoryActions ? (
            <Card>
              <CardTitle>Scan medicine or supply QR</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                Scan the inventory item used for this patient. Stock will be deducted automatically after saving.
              </p>
              <form className="mt-5 space-y-4" onSubmit={handleRecordInventoryUsage}>
                <FormField error={inventoryUsageForm.formState.errors.scannedCode?.message} label="Item QR code">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20 transition">
                    <ScanLine className="size-4 shrink-0 text-slate-400" />
                    <Input
                      className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                      placeholder="Scan item QR or paste item code"
                      {...inventoryUsageForm.register('scannedCode')}
                    />
                  </div>
                </FormField>
                {scannedInventoryItem ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-950">{scannedInventoryItem.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-700">
                      {scannedInventoryItem.qrCode} - {scannedInventoryItem.stockOnHand} {scannedInventoryItem.unit} available
                    </p>
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Linked visit">
                    <Select {...inventoryUsageForm.register('appointmentId')}>
                      <option value="">No specific visit</option>
                      {visits.map((visit) => (
                        <option key={visit.id} value={visit.id}>
                          {formatDateTimeLabel(visit.scheduledAt)} - {visit.reason}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField error={inventoryUsageForm.formState.errors.quantity?.message} label="Quantity used">
                    <Input type="number" {...inventoryUsageForm.register('quantity', { valueAsNumber: true })} />
                  </FormField>
                </div>
                <FormField error={inventoryUsageForm.formState.errors.notes?.message} label="Usage notes">
                  <Textarea rows={3} placeholder="Example: 2 tablets dispensed after consultation." {...inventoryUsageForm.register('notes')} />
                </FormField>
                <Button className="w-full" disabled={recordInventoryUsage.isPending} type="submit">
                  {recordInventoryUsage.isPending ? 'Recording usage...' : 'Record item usage'}
                </Button>
              </form>
            </Card>
          ) : null}
          </div>
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <Card>
            <CardTitle>Referral coordination</CardTitle>
            <div className="mt-5 space-y-4">
              {referrals.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-500">No referrals yet</p>
                  <p className="mt-1 text-xs text-slate-400">Specialist referrals for this patient will appear here.</p>
                </div>
              ) : (
                referrals.map((referral) => {
                  const referringDoctor = providers.find((doctor) => doctor.id === referral.referringDoctorId);
                  const targetDoctor = providers.find((doctor) => doctor.id === referral.targetDoctorId);
                  const isExpanded = activeReferralId === referral.id;
                  const trayContentId = `referral-tray-${referral.id}`;
                  const statusClass =
                    referral.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : referral.status === 'accepted'
                        ? 'bg-sky-100 text-sky-700'
                        : referral.status === 'confirmed'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-amber-100 text-amber-700';

                  return (
                    <div
                      key={referral.id}
                      className={`rounded-3xl border p-4 transition-all ${
                        isExpanded ? 'border-indigo-200 bg-indigo-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <button
                        aria-controls={trayContentId}
                        aria-expanded={isExpanded}
                        className="group flex w-full items-start justify-between gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        onClick={() =>
                          setExpandedReferralId((current) =>
                            (current === undefined ? referrals[0]?.id ?? null : current) === referral.id
                              ? null
                              : referral.id,
                          )
                        }
                        type="button"
                      >
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Referral Route</p>
                          <p className="font-semibold text-slate-950">
                            {referringDoctor?.fullName ?? 'Generalist'} to {targetDoctor?.fullName ?? 'Specialist'}
                          </p>
                          <p className="text-sm text-slate-500">{truncateText(referral.reason, 120)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${statusClass}`}>
                            {referral.status.replace('_', ' ')}
                          </span>
                          <span
                            className={`rounded-full p-1.5 transition-colors ${
                              isExpanded ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                            }`}
                          >
                            <ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </span>
                        </div>
                      </button>
                      {isExpanded ? (
                        <div className="mt-4 space-y-3 border-t border-indigo-100 pt-4" id={trayContentId}>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Reason</p>
                              <p className="mt-1 text-sm text-slate-700">{formatConsultationText(referral.reason)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Referred On</p>
                              <p className="mt-1 text-sm text-slate-700">{formatDateTimeLabel(referral.referredAt)}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Clinical Summary</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                              {formatConsultationText(referral.clinicalSummary)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Referral Notes</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                              {formatConsultationText(referral.referralNotes)}
                            </p>
                          </div>
                          {referral.specialistFindings ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700">Specialist Findings</p>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                                  {formatConsultationText(referral.specialistFindings)}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700">Recommendations</p>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                                  {formatConsultationText(referral.specialistRecommendations)}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
          <div className="space-y-6">
            {canDoctorActions && currentDoctor ? (
              <Card>
              <CardTitle>Refer to specialist</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                The generalist decides if this patient should be escalated, then the specialist can close the loop here.
              </p>
              <form className="mt-5 space-y-4" onSubmit={handleCreateReferral}>
                <FormField label="Specialist">
                  <Select {...referralForm.register('targetDoctorId')}>
                    <option value="">Select specialist</option>
                    {assignableDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.fullName}{doctor.specialtyName ? ` (${doctor.specialtyName})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Reason for referral">
                  <Input {...referralForm.register('reason')} />
                </FormField>
                <FormField label="Clinical summary">
                  <Textarea rows={4} {...referralForm.register('clinicalSummary')} />
                </FormField>
                <FormField label="Referral notes">
                  <Textarea rows={3} {...referralForm.register('referralNotes')} />
                </FormField>
                <Button className="w-full" disabled={createReferral.isPending || assignableDoctors.length === 0} type="submit">
                  {createReferral.isPending ? 'Sending...' : 'Create referral'}
                </Button>
              </form>
            </Card>
          ) : null}

          {canDoctorActions && pendingSpecialistReferral ? (
            <Card>
              <CardTitle>Specialist visit update</CardTitle>
              <form className="mt-5 space-y-4" onSubmit={handleSpecialistUpdate}>
                <FormField label="Visit date and time">
                  <Input type="datetime-local" {...specialistForm.register('specialistVisitedAt')} />
                </FormField>
                <FormField label="Referral status">
                  <Select {...specialistForm.register('status')}>
                    <option value="accepted">Accepted</option>
                    <option value="completed">Completed</option>
                  </Select>
                </FormField>
                <FormField label="Findings during specialist visit">
                  <Textarea rows={4} {...specialistForm.register('specialistFindings')} />
                </FormField>
                <FormField label="Recommendations for the generalist">
                  <Textarea rows={4} {...specialistForm.register('specialistRecommendations')} />
                </FormField>
                <Button className="w-full" disabled={updateReferralOutcome.isPending} type="submit">
                  {updateReferralOutcome.isPending ? 'Saving...' : 'Save specialist update'}
                </Button>
              </form>
            </Card>
          ) : null}

          {canDoctorActions && waitingFrontDeskReferral ? (
            <Card className="border-amber-200 bg-amber-50/70">
              <CardTitle>Awaiting front desk confirmation</CardTitle>
              <p className="mt-2 text-sm text-amber-800">
                This referral must be confirmed by front desk (specialist schedule and patient confirmation) before specialist update can proceed.
              </p>
            </Card>
          ) : null}

          {canDoctorActions && canConfirmReferral && frontDeskPendingReferral ? (
            <Card>
              <CardTitle>Front desk referral confirmation</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                Confirm specialist scheduling and patient coordination before specialist acceptance.
              </p>
              <form className="mt-5 space-y-4" onSubmit={handleFrontDeskConfirmation}>
                <FormField label="Status">
                  <Select {...frontDeskForm.register('status')}>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </FormField>
                <FormField label="Front desk notes">
                  <Textarea rows={3} {...frontDeskForm.register('referralNotes')} />
                </FormField>
                <Button className="w-full" disabled={updateReferralStatus.isPending} type="submit">
                  {updateReferralStatus.isPending ? 'Saving...' : 'Confirm referral coordination'}
                </Button>
              </form>
            </Card>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === 'lab-tests' && (
        <div className="mt-6">
          {/* ── Lab Test History ─────────────────────────────────────────── */}
          <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="size-5 text-violet-600" />
            <CardTitle>Lab test history</CardTitle>
          </div>
          <Badge intent={labOrders.length > 0 ? 'info' : 'neutral'}>{labOrders.length} order{labOrders.length !== 1 ? 's' : ''}</Badge>
        </div>

          {labOrders.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              className="flex-1 min-w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Search test name…"
              value={labSearch}
              onChange={(e) => setLabSearch(e.target.value)}
            />
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={labStatusFilter}
              onChange={(e) => setLabStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="requested">Requested</option>
              <option value="collected">Collected</option>
              <option value="processing">Processing</option>
              <option value="ready">Ready</option>
              <option value="released">Released</option>
            </select>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {filteredLabOrders.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center">
              <p className="text-sm font-semibold text-slate-500">
                {labOrders.length === 0 ? 'No lab orders yet' : 'No matching orders'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {labOrders.length === 0
                  ? 'Lab orders placed for this patient will appear here.'
                  : 'Try adjusting your search or status filter.'}
              </p>
            </div>
          ) : (
            (labExpanded ? filteredLabOrders : filteredLabOrders.slice(0, 10)).map((order) => {
              const svc = database.labServices.find((s) => s.id === order.labServiceId);
              const doctor = database.users.find((u) => u.id === order.requestedBy);
              const isExpanded = activeLabOrderId === order.id;
              const trayContentId = `lab-order-tray-${order.id}`;
              const statusClass =
                order.status === 'released'
                  ? 'bg-emerald-100 text-emerald-700'
                  : order.status === 'ready'
                    ? 'bg-sky-100 text-sky-700'
                    : order.status === 'processing'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-amber-100 text-amber-700';
              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    isExpanded ? 'border-violet-200 bg-violet-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <button
                    aria-controls={trayContentId}
                    aria-expanded={isExpanded}
                    className="group flex w-full items-start justify-between gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    onClick={() =>
                      setExpandedLabOrderId((current) =>
                        (current === undefined ? filteredLabOrders[0]?.id ?? null : current) === order.id
                          ? null
                          : order.id,
                      )
                    }
                    type="button"
                  >
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Lab Test</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-sm text-slate-950">{svc?.name ?? 'Unknown test'}</p>
                        {order.urgentFlag ? (
                          <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-rose-100 text-rose-600">Urgent</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-500">{doctor?.fullName ?? 'Unknown provider'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${statusClass}`}>
                        {order.status}
                      </span>
                      <span
                        className={`rounded-full p-1.5 transition-colors ${
                          isExpanded ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}
                      >
                        <ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="mt-4 space-y-3 border-t border-violet-100 pt-4" id={trayContentId}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Requested By</p>
                          <p className="mt-1 text-sm text-slate-700">{doctor?.fullName ?? 'Unknown provider'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Schedule</p>
                          <p className="mt-1 text-sm text-slate-700">
                            {order.schedDate ? `${order.schedDate}${order.schedTime ? ` at ${order.schedTime}` : ''}` : 'Not scheduled'}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Lab Notes</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                          {formatConsultationText(order.notes)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {filteredLabOrders.length > 10 && (
          <button
            type="button"
            className="mt-4 text-xs font-bold uppercase tracking-widest text-violet-600 hover:text-violet-800 transition-colors"
            onClick={() => setLabExpanded((v) => !v)}
          >
            {labExpanded ? 'Show less' : `Show all ${filteredLabOrders.length} orders`}
          </button>
        )}
      </Card>
        </div>
      )}

      {showVitalsModal && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={() => { setShowVitalsModal(false); vitalsForm.reset(); }}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-blue-600 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-widest text-blue-100">Patient Chart</p>
                <p className="mt-0.5 text-sm font-bold text-white">Record Vitals</p>
                <p className="mt-2 max-w-2xl text-sm text-blue-50">
                  Record the patient's current vital signs. These will be stored in the patient record and auto-populated in the next consultation.
                </p>
              </div>
              <button
                aria-label="Close vitals modal"
                className="inline-flex shrink-0 items-center justify-center border border-blue-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={() => { setShowVitalsModal(false); vitalsForm.reset(); }}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={vitalsForm.handleSubmit(async (values) => {
                try {
                  await updatePatient.mutateAsync({
                    patientId: patient?.id || '',
                    updates: {
                      temperature: values.temperature || undefined,
                      bloodPressure: values.bloodPressure || undefined,
                      heartRate: values.heartRate || undefined,
                      respiratoryRate: values.respiratoryRate || undefined,
                      weight: values.weight || undefined,
                      height: values.height || undefined,
                      vitalsRecordedAt: new Date().toISOString(),
                    },
                  });
                  toast.success('Vitals recorded successfully');
                  setShowVitalsModal(false);
                  vitalsForm.reset();
                } catch {
                  toast.error('Failed to record vitals');
                }
              })}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-4 py-5 sm:px-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField error={vitalsForm.formState.errors.temperature?.message} label="Temperature (°C)">
                      <Input type="number" step="0.1" placeholder="e.g., 37.5" {...vitalsForm.register('temperature')} />
                    </FormField>
                    <FormField error={vitalsForm.formState.errors.bloodPressure?.message} label="Blood Pressure (mmHg)">
                      <Input type="text" placeholder="e.g., 120/80" {...vitalsForm.register('bloodPressure')} />
                    </FormField>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField error={vitalsForm.formState.errors.heartRate?.message} label="Heart Rate (bpm)">
                      <Input type="number" step="1" placeholder="e.g., 72" {...vitalsForm.register('heartRate')} />
                    </FormField>
                    <FormField error={vitalsForm.formState.errors.respiratoryRate?.message} label="Respiratory Rate (breaths/min)">
                      <Input type="number" step="1" placeholder="e.g., 16" {...vitalsForm.register('respiratoryRate')} />
                    </FormField>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField error={vitalsForm.formState.errors.weight?.message} label="Weight (kg)">
                      <Input type="number" step="0.1" placeholder="e.g., 70.5" {...vitalsForm.register('weight')} />
                    </FormField>
                    <FormField error={vitalsForm.formState.errors.height?.message} label="Height (cm)">
                      <Input type="number" step="0.1" placeholder="e.g., 170" {...vitalsForm.register('height')} />
                    </FormField>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button
                  className="w-full rounded-none sm:w-auto"
                  onClick={() => { setShowVitalsModal(false); vitalsForm.reset(); }}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="w-full rounded-none bg-blue-600 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-blue-700 sm:w-auto"
                  disabled={updatePatient.isPending}
                  type="submit"
                >
                  {updatePatient.isPending ? 'Saving...' : 'Save Vitals'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



