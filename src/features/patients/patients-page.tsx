import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList, Pencil, QrCode, Search, Trash2, UserRoundPlus, Users, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { formatDateLabel } from '../../lib/utils';
import type { Patient } from '../../types/domain';
import { useAuth } from '../auth/auth-context';
import { useCreatePatient, useCreatePatientActionLog, useDeletePatient, usePatients, useUpdatePatient } from './hooks/use-patients';

const patientSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters.'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters.'),
  sex: z.enum(['male', 'female', 'other']),
  birthDate: z.string().min(1, 'Birth date is required.'),
  mobileNumber: z.string().min(5, 'Mobile number must be at least 5 digits.'),
  email: z.email('Enter a valid email address.'),
  address: z.string().min(4, 'Address must be at least 4 characters.'),
  bloodType: z.string().min(1, 'Blood type is required.'),
  allergies: z.string().min(1, 'Allergies field is required.'),
  medicalHistory: z.string().min(1, 'Medical history field is required.'),
  emergencyContactName: z.string().min(2, 'Emergency contact name must be at least 2 characters.'),
  emergencyContactPhone: z.string().min(5, 'Emergency contact phone must be at least 5 digits.'),
});

type PatientFormValues = z.infer<typeof patientSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

const patientFieldLabels: Record<keyof PatientFormValues, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  sex: 'Sex',
  birthDate: 'Birth date',
  mobileNumber: 'Mobile number',
  email: 'Email',
  address: 'Address',
  bloodType: 'Blood type',
  allergies: 'Allergies',
  medicalHistory: 'Medical history',
  emergencyContactName: 'Emergency contact name',
  emergencyContactPhone: 'Emergency contact phone',
};

const walkInSteps = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Basic identity details for the patient record.',
    fields: ['firstName', 'lastName', 'sex', 'birthDate'] as const,
  },
  {
    id: 'contact',
    title: 'Contact Details',
    description: 'How the clinic can contact the patient.',
    fields: ['mobileNumber', 'email', 'address'] as const,
  },
  {
    id: 'medical',
    title: 'Medical Info',
    description: 'Core medical notes for intake.',
    fields: ['bloodType', 'allergies', 'medicalHistory'] as const,
  },
  {
    id: 'emergency',
    title: 'Emergency Contact',
    description: 'Who to contact in case of emergency.',
    fields: ['emergencyContactName', 'emergencyContactPhone'] as const,
  },
] as const;

const PATIENTS_PAGE_SIZE = 10;

function getPatientSourceLabel(patient: Patient) {
  return patient.intakeSource === 'online_registration' ? 'Online registration' : 'Walk-in encoded by staff';
}

function getPatientVisitBadge(patient: Patient) {
  if (patient.visitStatus === 'registered_no_visit') {
    return { label: 'Not visited yet', intent: 'warning' as const };
  }

  return { label: 'Visited clinic', intent: 'success' as const };
}

export function PatientsPage() {
  const { data: patients = [] } = usePatients();
  const { can, profile } = useAuth();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const deletePatient = useDeletePatient();
  const createPatientActionLog = useCreatePatientActionLog();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInStepIndex, setWalkInStepIndex] = useState(0);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      sex: 'female',
      birthDate: '',
      mobileNumber: '',
      email: '',
      address: '',
      bloodType: '',
      allergies: 'None reported',
      medicalHistory: 'No significant medical history yet',
      emergencyContactName: '',
      emergencyContactPhone: '',
    },
  });

  const filteredPatients = useMemo(
    () =>
      patients.filter((patient) =>
        `${patient.firstName} ${patient.lastName} ${patient.email} ${patient.mobileNumber} ${patient.qrCode} ${patient.intakeSource} ${patient.visitStatus}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, patients],
  );
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PATIENTS_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PATIENTS_PAGE_SIZE;
  const paginatedPatients = useMemo(
    () => filteredPatients.slice(pageStart, pageStart + PATIENTS_PAGE_SIZE),
    [filteredPatients, pageStart],
  );
  const showingStart = filteredPatients.length === 0 ? 0 : pageStart + 1;
  const showingEnd = filteredPatients.length === 0 ? 0 : Math.min(pageStart + PATIENTS_PAGE_SIZE, filteredPatients.length);

  useEffect(() => {
    if (!isWalkInModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsWalkInModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWalkInModalOpen]);

  const openWalkInModal = () => {
    form.reset();
    setEditingPatient(null);
    setWalkInStepIndex(0);
    setIsWalkInModalOpen(true);
  };

  const openEditPatientModal = (patient: Patient) => {
    form.reset({
      firstName: patient.firstName,
      lastName: patient.lastName,
      sex: patient.sex,
      birthDate: patient.birthDate,
      mobileNumber: patient.mobileNumber,
      email: patient.email,
      address: patient.address,
      bloodType: patient.bloodType,
      allergies: patient.allergies,
      medicalHistory: patient.medicalHistory,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
    });
    setEditingPatient(patient);
    setWalkInStepIndex(0);
    setIsWalkInModalOpen(true);
  };

  const closeWalkInModal = () => {
    setWalkInStepIndex(0);
    setEditingPatient(null);
    setIsWalkInModalOpen(false);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingPatient) {
        const payload = {
          ...editingPatient,
          ...values,
        };

        await updatePatient.mutateAsync({
          patientId: editingPatient.id,
          payload: {
            userId: payload.userId ?? null,
            qrCode: payload.qrCode,
            intakeSource: payload.intakeSource,
            visitStatus: payload.visitStatus,
            firstName: payload.firstName,
            lastName: payload.lastName,
            sex: payload.sex,
            birthDate: payload.birthDate,
            mobileNumber: payload.mobileNumber,
            email: payload.email,
            address: payload.address,
            bloodType: payload.bloodType,
            allergies: payload.allergies,
            medicalHistory: payload.medicalHistory,
            emergencyContactName: payload.emergencyContactName,
            emergencyContactPhone: payload.emergencyContactPhone,
          },
        });

        const changedFields = (Object.keys(values) as Array<keyof PatientFormValues>).filter(
          (field) => values[field] !== editingPatient[field],
        );

        await createPatientActionLog.mutateAsync({
          action: 'edit',
          actorId: profile?.id ?? 'system',
          actorName: profile?.fullName ?? 'System User',
          patientId: editingPatient.id,
          patientName: `${values.firstName} ${values.lastName}`,
          summary:
            changedFields.length > 0
              ? `Updated ${changedFields.length} important field${changedFields.length !== 1 ? 's' : ''} for this patient record.`
              : 'Opened the patient editor and saved without changing important fields.',
          fields: changedFields.length > 0 ? changedFields.map((field) => patientFieldLabels[field]) : ['No important fields changed'],
        });

        setFeedbackModal({
          open: true,
          title: 'Patient record updated',
          message: 'The patient information was updated successfully.',
          variant: 'success',
        });
      } else {
        await createPatient.mutateAsync({
          ...values,
          userId: null,
          qrCode: '',
          intakeSource: 'staff_walk_in',
          visitStatus: 'visited_clinic',
        });
        setFeedbackModal({
          open: true,
          title: 'Walk-in patient added',
          message: 'The patient record was created successfully and is now available in the registry.',
          variant: 'success',
        });
      }

      form.reset();
      setWalkInStepIndex(0);
      setEditingPatient(null);
      setIsWalkInModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong while creating the patient record.';

      setFeedbackModal({
        open: true,
        title: 'Unable to add walk-in patient',
        message,
        variant: 'error',
      });
    }
  });

  const currentStep = walkInSteps[walkInStepIndex];
  const isLastStep = walkInStepIndex === walkInSteps.length - 1;

  const goToNextStep = async () => {
    const isStepValid = await form.trigger([...currentStep.fields]);
    if (!isStepValid) {
      return;
    }

    setWalkInStepIndex((currentIndex) => Math.min(currentIndex + 1, walkInSteps.length - 1));
  };

  const goToPreviousStep = () => {
    setWalkInStepIndex((currentIndex) => Math.max(currentIndex - 1, 0));
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const handleDeletePatient = async (patient: Patient) => {
    const isConfirmed = window.confirm(`Delete ${patient.firstName} ${patient.lastName} from the patient registry?`);
    if (!isConfirmed) {
      return;
    }

    try {
      await deletePatient.mutateAsync(patient.id);
      await createPatientActionLog.mutateAsync({
        action: 'delete',
        actorId: profile?.id ?? 'system',
        actorName: profile?.fullName ?? 'System User',
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        summary: `Deleted the patient record and removed it from the registry list.`,
        fields: ['Patient record', 'QR code', 'Contact reference'],
      });
      setFeedbackModal({
        open: true,
        title: 'Patient record deleted',
        message: 'The patient record was removed successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to delete patient',
        message: error instanceof Error ? error.message : 'Something went wrong while deleting the patient record.',
        variant: 'error',
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Patient Management</p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Unified Patient Registry</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Online registrations appear here automatically, while walk-ins can be encoded by staff during the clinic visit.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {can('patients.manage') ? (
                <Button
                  className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700"
                  onClick={openWalkInModal}
                >
                  <UserRoundPlus className="mr-2 size-4" />
                  Add walk-in patient
                </Button>
              ) : null}
              <Link
                className="inline-flex items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                to="/app/patients/logs"
              >
                <ClipboardList className="mr-2 size-4" />
                View logs
              </Link>
              <Link
                className="inline-flex items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                to="/app/patients/scan"
              >
                <QrCode className="mr-2 size-4" />
                Scan patient QR
              </Link>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search patient, email, QR code, or intake type"
                  value={search}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
            <span className="text-xs font-bold text-slate-500">{filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} found</span>
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center border border-orange-100 bg-orange-50">
              <UserRoundPlus className="size-6 text-orange-600" />
            </div>
            <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-slate-950">No patients found</p>
            <p className="max-w-xs text-xs leading-relaxed text-slate-500">
              Online registrations and walk-in records will appear here once patients start entering the system.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Patient</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Contact</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Birth date</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Source</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Status</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">QR code</th>
                    <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPatients.map((patient) => {
                    const visitBadge = getPatientVisitBadge(patient);

                    return (
                      <tr className="transition-colors hover:bg-slate-50" key={patient.id}>
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-950">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest">
                                {patient.bloodType || 'Unspecified'}
                              </Badge>
                              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{patient.sex}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-1 text-sm text-slate-600">
                            <p>{patient.email}</p>
                            <p>{patient.mobileNumber}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-slate-600">{formatDateLabel(patient.birthDate)}</td>
                        <td className="px-6 py-4 align-top">
                          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{getPatientSourceLabel(patient)}</span>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest" intent={visitBadge.intent}>
                            {visitBadge.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 align-top text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          {patient.qrCode || 'Pending QR'}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex min-w-max flex-col items-end gap-2 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                            {can('patients.manage') ? (
                              <button
                                className="inline-flex items-center gap-1 text-slate-600 hover:underline"
                                onClick={() => openEditPatientModal(patient)}
                                type="button"
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </button>
                            ) : null}
                            {can('patients.manage') ? (
                              <button
                                className="inline-flex items-center gap-1 text-rose-600 hover:underline"
                                onClick={() => void handleDeletePatient(patient)}
                                type="button"
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </button>
                            ) : null}
                            <Link className="inline-flex items-center text-orange-600 hover:underline" to={`/app/patients/${patient.id}`}>
                              Open Record
                            </Link>
                            
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredPatients.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  Showing {showingStart}-{showingEnd} of {filteredPatients.length} patients
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    className="rounded-none border-slate-300 px-3 py-1 text-xs font-bold uppercase tracking-wide"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    type="button"
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <Button
                    className="rounded-none border-slate-300 px-3 py-1 text-xs font-bold uppercase tracking-wide"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    type="button"
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {isWalkInModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeWalkInModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-orange-600 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">Walk-In Intake</p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {editingPatient ? 'Edit Patient Record' : 'Create Staff-Encoded Patient Record'}
                </p>
                <p className="mt-2 max-w-2xl text-sm text-orange-50">
                  {editingPatient
                    ? 'Update the most important patient details here. Only the key changed fields will be recorded in the patient logs.'
                    : 'Use this form for patients who arrive at the clinic without an existing portal account. The record will be tagged as a walk-in patient who has already visited the clinic.'}
                </p>
              </div>
              <button
                aria-label="Close walk-in patient modal"
                className="inline-flex shrink-0 items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeWalkInModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600">
                      Step {walkInStepIndex + 1} of {walkInSteps.length}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{currentStep.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{currentStep.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {walkInSteps.map((step, index) => (
                      <span
                        className={`h-2.5 w-10 ${index <= walkInStepIndex ? 'bg-orange-600' : 'bg-slate-200'}`}
                        key={step.id}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {currentStep.id === 'personal' ? (
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField error={form.formState.errors.firstName?.message} label="First name">
                        <Input {...form.register('firstName')} />
                      </FormField>
                      <FormField error={form.formState.errors.lastName?.message} label="Last name">
                        <Input {...form.register('lastName')} />
                      </FormField>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField label="Sex">
                        <select className="w-full border border-slate-200 bg-white px-3 py-2.5 text-sm" {...form.register('sex')}>
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="other">Other</option>
                        </select>
                      </FormField>
                      <FormField error={form.formState.errors.birthDate?.message} label="Birth date">
                        <Input type="date" {...form.register('birthDate')} />
                      </FormField>
                    </div>
                  </div>
                ) : null}

                {currentStep.id === 'contact' ? (
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField error={form.formState.errors.mobileNumber?.message} label="Mobile number">
                        <Input {...form.register('mobileNumber')} />
                      </FormField>
                      <FormField error={form.formState.errors.email?.message} label="Email">
                        <Input {...form.register('email')} />
                      </FormField>
                    </div>
                    <FormField error={form.formState.errors.address?.message} label="Address">
                      <Input {...form.register('address')} />
                    </FormField>
                  </div>
                ) : null}

                {currentStep.id === 'medical' ? (
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField error={form.formState.errors.bloodType?.message} label="Blood type">
                        <Input {...form.register('bloodType')} />
                      </FormField>
                      <FormField error={form.formState.errors.allergies?.message} label="Allergies">
                        <Input {...form.register('allergies')} />
                      </FormField>
                    </div>
                    <FormField error={form.formState.errors.medicalHistory?.message} label="Medical history">
                      <Textarea {...form.register('medicalHistory')} />
                    </FormField>
                  </div>
                ) : null}

                {currentStep.id === 'emergency' ? (
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField error={form.formState.errors.emergencyContactName?.message} label="Contact name">
                        <Input {...form.register('emergencyContactName')} />
                      </FormField>
                      <FormField error={form.formState.errors.emergencyContactPhone?.message} label="Contact phone">
                        <Input {...form.register('emergencyContactPhone')} />
                      </FormField>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeWalkInModal} type="button" variant="secondary">
                  Cancel
                </Button>
                {walkInStepIndex > 0 ? (
                  <Button className="w-full rounded-none sm:w-auto" onClick={goToPreviousStep} type="button" variant="secondary">
                    Back
                  </Button>
                ) : null}
                {isLastStep ? (
                  <Button
                    className="w-full rounded-none bg-orange-600 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700 sm:w-auto"
                    disabled={createPatient.isPending}
                    type="submit"
                  >
                    {createPatient.isPending || updatePatient.isPending
                      ? 'Saving...'
                      : editingPatient
                        ? 'Save Patient Changes'
                        : 'Create Walk-In Patient'}
                  </Button>
                ) : (
                  <Button
                    className="w-full rounded-none bg-orange-600 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700 sm:w-auto"
                    onClick={() => void goToNextStep()}
                    type="button"
                  >
                    Next
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <FeedbackModal
        autoCloseMs={3000}
        message={feedbackModal.message}
        onClose={closeFeedbackModal}
        open={feedbackModal.open}
        title={feedbackModal.title}
        variant={feedbackModal.variant}
      />
    </>
  );
}
