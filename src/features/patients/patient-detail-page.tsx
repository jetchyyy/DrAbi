import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Eye, FileText, FlaskConical, Pill, QrCode, ScanLine, TestTubeDiagonal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  prescriptionName: z.string().min(2, 'Prescription name is required.'),
  dosage: z.string().min(2, 'Dosage is required.'),
  instruction: z.string().min(2, 'Instruction is required.'),
});

const medicalCertificateSchema = z.object({
  consultationId: z.string().min(1, 'Save a consultation first or choose an existing one.'),
  certificatePurpose: z.string().min(2, 'Certificate purpose is required.'),
  diagnosis: z.string().min(2, 'Diagnosis is required.'),
  recommendation: z.string().min(2, 'Recommendation is required.'),
  restFrom: z.string().optional(),
  restUntil: z.string().optional(),
});

const inventoryUsageSchema = z.object({
  scannedCode: z.string().min(1, 'Scan or paste the inventory QR code.'),
  appointmentId: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1.'),
  notes: z.string().min(4, 'Add a short note about how the item was used.'),
});

function formatConsultationText(value: string | null | undefined) {
  const text = (value ?? '').trim();
  return text.length > 0 ? text : 'Not provided';
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
  prescription: Prescription;
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
    issuedDate: input.prescription.createdAt,
    medicationName: input.prescription.prescriptionName,
    dosage: input.prescription.dosage,
    instruction: input.prescription.instruction,
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

function buildSavedMedicalCertificateDocument(input: {
  patientName: string;
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
    issuedDate: input.medicalCertificate.createdAt,
    certificatePurpose: input.medicalCertificate.certificatePurpose,
    diagnosis: input.medicalCertificate.diagnosis,
    recommendation: input.medicalCertificate.recommendation,
    restFrom: input.medicalCertificate.restFrom ?? '',
    restUntil: input.medicalCertificate.restUntil ?? '',
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
      prescriptionName: '',
      dosage: '',
      instruction: '',
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
  const [expandedMedicalCertificateId, setExpandedMedicalCertificateId] = useState<string | null | undefined>(undefined);
  const [expandedReferralId, setExpandedReferralId] = useState<string | null | undefined>(undefined);
  const [expandedLabOrderId, setExpandedLabOrderId] = useState<string | null | undefined>(undefined);

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
      ? (prescriptions[0]?.id ?? null)
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
        <CardTitle>Loading patient record...</CardTitle>
      </Card>
    );
  }

  if (!patient) {
    return (
      <Card>
        <CardTitle>Patient not found</CardTitle>
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
    const createdPrescription = await createPrescription.mutateAsync({
      consultationId: values.consultationId,
      patientId: patient.id,
      prescriptionName: values.prescriptionName,
      dosage: values.dosage,
      instruction: values.instruction,
    });

    setSavedPrescription(createdPrescription);
    setShowPrescriptionStatusModal(true);

    prescriptionForm.reset({
      consultationId: values.consultationId,
      prescriptionName: '',
      dosage: '',
      instruction: '',
    });
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
    setShowMedicalCertificateStatusModal(true);

    medicalCertificateForm.reset({
      consultationId: values.consultationId,
      certificatePurpose: '',
      diagnosis: '',
      recommendation: '',
      restFrom: '',
      restUntil: '',
    });
  });

  const buildPrescriptionDocumentFor = (prescription: Prescription | null) => {
    if (!prescription) {
      return null;
    }

    const linkedConsultation = consultations.find((consultation) => consultation.id === prescription.consultationId) ?? null;
    const linkedDoctor = linkedConsultation
      ? providers.find((provider) => provider.id === linkedConsultation.doctorId) ?? null
      : null;
    const nextAppointment = linkedConsultation
      ? `${linkedConsultation.consultationDate} ${linkedConsultation.consultationTime}`
      : '________________';
    const doctorName = linkedDoctor?.fullName ?? linkedConsultation?.providerName ?? currentDoctor?.fullName ?? profile?.fullName ?? 'Attending Physician';
    const doctorSpecialty = linkedDoctor?.specialtyName ?? currentDoctor?.specialtyName ?? 'Physician';
    const doctorLicenseNumber = linkedDoctor?.licenseNumber ?? currentDoctor?.licenseNumber ?? '';
    const doctorBirNumber = linkedDoctor?.birNumber ?? currentDoctor?.birNumber ?? '';
    const doctorPtrNumber = linkedDoctor?.ptrNumber ?? currentDoctor?.ptrNumber ?? '';

    return buildSavedPrescriptionDocument({
      patientName: `${patient.firstName} ${patient.lastName}`,
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
      prescription,
      nextAppointment,
    });
  };

  const buildMedicalCertificateDocumentFor = (medicalCertificate: MedicalCertificate | null) => {
    if (!medicalCertificate) {
      return null;
    }

    const linkedConsultation = consultations.find((consultation) => consultation.id === medicalCertificate.consultationId) ?? null;
    const linkedDoctor = linkedConsultation
      ? providers.find((provider) => provider.id === linkedConsultation.doctorId) ?? null
      : null;
    const doctorName = linkedDoctor?.fullName ?? linkedConsultation?.providerName ?? currentDoctor?.fullName ?? profile?.fullName ?? 'Attending Physician';
    const doctorSpecialty = linkedDoctor?.specialtyName ?? currentDoctor?.specialtyName ?? 'Physician';
    const doctorLicenseNumber = linkedDoctor?.licenseNumber ?? currentDoctor?.licenseNumber ?? '';
    const doctorBirNumber = linkedDoctor?.birNumber ?? currentDoctor?.birNumber ?? '';
    const doctorPtrNumber = linkedDoctor?.ptrNumber ?? currentDoctor?.ptrNumber ?? '';

    return buildSavedMedicalCertificateDocument({
      patientName: `${patient.firstName} ${patient.lastName}`,
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
    });
  };

  const getSavedPrescriptionDocument = () => buildPrescriptionDocumentFor(savedPrescription);

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
    const documentHtml = buildPrescriptionDocumentFor(latestPrescription);
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
    const documentHtml = buildPrescriptionDocumentFor(prescription);
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Patient chart</p>
              <CardTitle className="mt-2 text-3xl">
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <p className="mt-2 text-sm text-slate-500">{patient.email} | {patient.mobileNumber}</p>
              <p className="mt-2 text-sm font-medium text-slate-700">QR code: <span className="font-mono">{patient.qrCode}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canClinicalActions ? (
                <Link
                  className="inline-flex items-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-orange-700 transition hover:bg-orange-100"
                  to={`/app/consultation/${patient.id}`}
                >
                  Start Consultation
                </Link>
              ) : null}
              <Badge>{patient.bloodType || 'Blood type pending'}</Badge>
              <Badge intent="warning">{patient.allergies}</Badge>
            </div>
          </div>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-sky-200 bg-sky-50/50">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-sky-600" />
              <CardTitle className="text-base">Consultations</CardTitle>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{consultations.length}</p>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <div className="flex items-center gap-3">
              <Pill className="size-5 text-emerald-600" />
              <CardTitle className="text-base">Prescriptions</CardTitle>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{prescriptions.length}</p>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <div className="flex items-center gap-3">
              <QrCode className="size-5 text-amber-600" />
              <CardTitle className="text-base">Items used</CardTitle>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{inventoryUsageLogs.length}</p>
          </Card>
          <Card className="border-violet-200 bg-violet-50/50">
            <div className="flex items-center gap-3">
              <TestTubeDiagonal className="size-5 text-violet-600" />
              <CardTitle className="text-base">Lab orders</CardTitle>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{labOrders.length}</p>
          </Card>
        </div>
        </div>

        <PatientQrCard patientName={`${patient.firstName} ${patient.lastName}`} qrCode={patient.qrCode} />
      </div>

      <div className="mt-4 flex space-x-2 overflow-x-auto border-b border-slate-200 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab.id ? 'bg-[var(--color-primary)] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
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
                  <p className="text-sm text-slate-500">No visits recorded yet for this patient.</p>
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
              <p className="text-sm text-slate-500">No SOAP notes have been saved for this patient yet.</p>
            ) : (
              consultationTimeline.map(({ consultation, appointment }) => {
                const isExpanded = activeConsultationId === consultation.id;
                const trayContentId = `consultation-tray-${consultation.id}`;

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
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatConsultationText(consultation.vitals)}
                          </p>
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
            <div className="mt-5 space-y-4">
              {prescriptions.length === 0 ? (
                <p className="text-sm text-slate-500">No prescriptions have been recorded for this patient yet.</p>
              ) : (
                prescriptions.map((prescription) => {
                  const linkedConsultation = consultations.find((consultation) => consultation.id === prescription.consultationId);
                  const isExpanded = activePrescriptionId === prescription.id;
                  const trayContentId = `prescription-tray-${prescription.id}`;
                  return (
                    <div
                      key={prescription.id}
                      className={`rounded-3xl border p-4 transition-all ${
                        isExpanded ? 'border-sky-200 bg-sky-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          aria-controls={trayContentId}
                          aria-expanded={isExpanded}
                          className="group min-w-0 flex-1 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                          onClick={() =>
                            setExpandedPrescriptionId((current) =>
                              (current === undefined ? prescriptions[0]?.id ?? null : current) === prescription.id
                                ? null
                                : prescription.id,
                            )
                          }
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Prescription</p>
                              <p className="font-semibold text-slate-950">{prescription.prescriptionName}</p>
                              <p className="text-sm text-slate-500">
                                {linkedConsultation ? `${linkedConsultation.consultationDate} ${linkedConsultation.consultationTime}` : 'Prescription saved'}
                              </p>
                            </div>
                            <span
                              className={`rounded-full p-1.5 transition-colors ${
                                isExpanded ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
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
                            disabled={isViewingLatestPrescriptionFile}
                            onClick={() => handleViewPrescriptionFromHistory(prescription)}
                            type="button"
                            variant="secondary"
                          >
                            <Eye className="mr-1.5 size-3.5" />
                            View
                          </Button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="mt-4 space-y-3 border-t border-sky-100 pt-4" id={trayContentId}>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Dosage</p>
                              <p className="mt-1 text-sm text-slate-700">{formatConsultationText(prescription.dosage)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Issued</p>
                              <p className="mt-1 text-sm text-slate-700">{formatDateTimeLabel(prescription.createdAt)}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Instruction</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                              {formatConsultationText(prescription.instruction)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          {truncateText(prescription.instruction, 120)}
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
              <CardTitle>Prescription details</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                Add the patient prescription after saving the consultation, or attach it to an existing consultation entry.
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
                <FormField error={prescriptionForm.formState.errors.prescriptionName?.message} label="Prescription Name">
                  <Input {...prescriptionForm.register('prescriptionName')} />
                </FormField>
                <FormField error={prescriptionForm.formState.errors.dosage?.message} label="Dosage">
                  <Input {...prescriptionForm.register('dosage')} />
                </FormField>
                <FormField error={prescriptionForm.formState.errors.instruction?.message} label="Instruction">
                  <Textarea rows={3} {...prescriptionForm.register('instruction')} />
                </FormField>
                <Button className="w-full" disabled={createPrescription.isPending} type="submit">
                  {createPrescription.isPending ? 'Saving prescription...' : 'Save prescription'}
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
                <p className="text-sm text-slate-500">No medical certificates have been recorded for this patient yet.</p>
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
                <p className="text-sm text-slate-500">No medicines or supplies have been recorded for this patient yet.</p>
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
                  <div className="flex items-center gap-3 border border-slate-200 bg-slate-50 px-4 py-3">
                    <ScanLine className="size-4 text-slate-400" />
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
                <p className="text-sm text-slate-500">No referrals have been recorded for this patient yet.</p>
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
              className="flex-1 min-w-40 border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Search test name…"
              value={labSearch}
              onChange={(e) => setLabSearch(e.target.value)}
            />
            <select
              className="border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
            <p className="text-sm text-slate-500">
              {labOrders.length === 0
                ? 'No lab orders have been placed for this patient yet.'
                : 'No lab orders match the current filter.'}
            </p>
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
    </div>
  );
}



