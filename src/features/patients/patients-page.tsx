import { zodResolver } from "@hookform/resolvers/zod";
import {
  ClipboardList,
  ClipboardPlus,
  Pencil,
  QrCode,
  Search,
  Trash2,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { FeedbackModal } from "../../components/ui/feedback-modal";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  INTERNAL_BTN_PAGE,
  INTERNAL_SEARCH_INPUT_WRAP,
  INTERNAL_SURFACE,
  INTERNAL_SURFACE_FOOTER,
  INTERNAL_TABLE,
  INTERNAL_TABLE_SCROLL,
  INTERNAL_TD,
  INTERNAL_TH,
  INTERNAL_THEAD_ROW,
  INTERNAL_TR,
} from "../../lib/internal-ui";
import { cn, formatDateLabel } from "../../lib/utils";
import type { Patient } from "../../types/domain";
import { useAuth } from "../auth/auth-context";
import {
  useCreatePatient,
  useCreatePatientActionLog,
  useDeletePatient,
  usePatients,
  useUpdatePatient,
} from "./hooks/use-patients";

const patientSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  sex: z.enum(["male", "female", "other"]),
  birthDate: z.string().min(1, "Birth date is required."),
  mobileNumber: z
    .string()
    .regex(/^\d{11}$/, "Mobile number must be exactly 11 digits."),
  email: z.email("Enter a valid email address."),
  address: z.string().min(4, "Address must be at least 4 characters."),
  bloodType: z.string().min(1, "Blood type is required."),
  allergies: z.string().min(1, "Allergies field is required."),
  medicalHistory: z.string().min(1, "Medical history field is required."),
  emergencyContactName: z
    .string()
    .min(2, "Emergency contact name must be at least 2 characters."),
  emergencyContactPhone: z
    .string()
    .regex(/^\d{11}$/, "Emergency contact phone must be exactly 11 digits."),
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
  o2Sat: z.string().optional(),
  respiratoryRate: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: "success" | "error";
}

const patientFieldLabels: Record<keyof PatientFormValues, string> = {
  firstName: "First name",
  lastName: "Last name",
  sex: "Sex",
  birthDate: "Birth date",
  mobileNumber: "Mobile number",
  email: "Email",
  address: "Address",
  bloodType: "Blood type",
  allergies: "Allergies",
  medicalHistory: "Medical history",
  emergencyContactName: "Emergency contact name",
  emergencyContactPhone: "Emergency contact phone",
  temperature: "Temperature (°C)",
  bloodPressure: "Blood Pressure (mmHg)",
  heartRate: "Heart Rate (bpm)",
  o2Sat: "O2sat (%)",
  respiratoryRate: "Respiratory Rate (breaths/min)",
  weight: "Weight (kg)",
  height: "Height (cm)",
};

const walkInSteps = [
  {
    id: "personal",
    title: "Personal Information",
    description: "Basic identity details for the patient record.",
    fields: ["firstName", "lastName", "sex", "birthDate"] as const,
  },
  {
    id: "contact",
    title: "Contact Details",
    description: "How the clinic can contact the patient.",
    fields: ["mobileNumber", "email", "address"] as const,
  },
  {
    id: "medical",
    title: "Medical Info",
    description: "Core medical notes for intake.",
    fields: ["bloodType", "allergies", "medicalHistory"] as const,
  },
  {
    id: "vitals",
    title: "Vitals",
    description: "Record patient vital signs at time of intake.",
    fields: [
      "temperature",
      "bloodPressure",
      "heartRate",
      "o2Sat",
      "respiratoryRate",
      "weight",
      "height",
    ] as const,
  },
  {
    id: "emergency",
    title: "Emergency Contact",
    description: "Who to contact in case of emergency.",
    fields: ["emergencyContactName", "emergencyContactPhone"] as const,
  },
] as const;

const PATIENTS_PAGE_SIZE = 10;

function sanitizeMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function getPatientSourceLabel(patient: Patient) {
  return patient.intakeSource === "online_registration"
    ? "Online registration"
    : "Walk-in encoded by staff";
}

export function PatientsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: patients = [] } = usePatients();
  const { can, profile } = useAuth();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const deletePatient = useDeletePatient();
  const createPatientActionLog = useCreatePatientActionLog();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInStepIndex, setWalkInStepIndex] = useState(0);
  const [walkInNextStep, setWalkInNextStep] = useState<"none" | "appointment">(
    "none",
  );
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: "",
    message: "",
    variant: "success",
  });
  const deferredSearch = useDeferredValue(search);
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      sex: "female",
      birthDate: "",
      mobileNumber: "",
      email: "",
      address: "",
      bloodType: "",
      allergies: "None reported",
      medicalHistory: "No significant medical history yet",
      emergencyContactName: "",
      emergencyContactPhone: "",
      temperature: "",
      bloodPressure: "",
      heartRate: "",
      o2Sat: "",
      respiratoryRate: "",
      weight: "",
      height: "",
    },
  });

  const filteredPatients = useMemo(
    () =>
      patients.filter((patient) =>
        `${patient.firstName} ${patient.lastName} ${patient.email} ${patient.mobileNumber} ${patient.qrCode} ${patient.uniqueLoginId ?? ""} ${patient.intakeSource} ${patient.visitStatus}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, patients],
  );

  useEffect(() => {
    const action = (searchParams.get("action") ?? "").trim();
    if (action !== "walk-in-intake") {
      return;
    }

    const next = (searchParams.get("next") ?? "").trim();
    setWalkInNextStep(next === "appointment" ? "appointment" : "none");
    form.reset();
    setEditingPatient(null);
    setWalkInStepIndex(0);
    setIsWalkInModalOpen(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("action");
    nextParams.delete("next");
    setSearchParams(nextParams, { replace: true });
  }, [form, searchParams, setSearchParams]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPatients.length / PATIENTS_PAGE_SIZE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PATIENTS_PAGE_SIZE;
  const paginatedPatients = useMemo(
    () => filteredPatients.slice(pageStart, pageStart + PATIENTS_PAGE_SIZE),
    [filteredPatients, pageStart],
  );
  const showingStart = filteredPatients.length === 0 ? 0 : pageStart + 1;
  const showingEnd =
    filteredPatients.length === 0
      ? 0
      : Math.min(pageStart + PATIENTS_PAGE_SIZE, filteredPatients.length);

  useEffect(() => {
    if (!isWalkInModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsWalkInModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWalkInModalOpen]);

  const openWalkInModal = () => {
    form.reset();
    setEditingPatient(null);
    setWalkInStepIndex(0);
    setWalkInNextStep("none");
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
      temperature: patient.temperature ?? "",
      bloodPressure: patient.bloodPressure ?? "",
      heartRate: patient.heartRate ?? "",
      o2Sat: patient.o2Sat ?? "",
      respiratoryRate: patient.respiratoryRate ?? "",
      weight: patient.weight ?? "",
      height: patient.height ?? "",
    });
    setEditingPatient(patient);
    setWalkInStepIndex(0);
    setIsWalkInModalOpen(true);
  };

  const closeWalkInModal = () => {
    setWalkInStepIndex(0);
    setEditingPatient(null);
    setWalkInNextStep("none");
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
            temperature: payload.temperature,
            bloodPressure: payload.bloodPressure,
            heartRate: payload.heartRate,
            o2Sat: payload.o2Sat,
            respiratoryRate: payload.respiratoryRate,
            weight: payload.weight,
            height: payload.height,
            vitalsRecordedAt:
              payload.temperature ||
              payload.bloodPressure ||
              payload.heartRate ||
              payload.o2Sat ||
              payload.respiratoryRate ||
              payload.weight ||
              payload.height
                ? new Date().toISOString()
                : (editingPatient.vitalsRecordedAt ?? null),
          },
        });

        const changedFields = (
          Object.keys(values) as Array<keyof PatientFormValues>
        ).filter((field) => values[field] !== editingPatient[field]);

        await createPatientActionLog.mutateAsync({
          action: "edit",
          actorId: profile?.id ?? "system",
          actorName: profile?.fullName ?? "System User",
          patientId: editingPatient.id,
          patientName: `${values.firstName} ${values.lastName}`,
          summary:
            changedFields.length > 0
              ? `Updated ${changedFields.length} important field${changedFields.length !== 1 ? "s" : ""} for this patient record.`
              : "Opened the patient editor and saved without changing important fields.",
          fields:
            changedFields.length > 0
              ? changedFields.map((field) => patientFieldLabels[field])
              : ["No important fields changed"],
        });

        setFeedbackModal({
          open: true,
          title: "Patient record updated",
          message: "The patient information was updated successfully.",
          variant: "success",
        });
      } else {
        const vitalsRecordedAt =
          values.temperature ||
          values.bloodPressure ||
          values.heartRate ||
          values.o2Sat ||
          values.respiratoryRate ||
          values.weight ||
          values.height
            ? new Date().toISOString()
            : null;

        const createdPatient = await createPatient.mutateAsync({
          ...values,
          userId: null,
          qrCode: "",
          intakeSource: "staff_walk_in",
          visitStatus: "visited_clinic",
          vitalsRecordedAt,
        });
        setFeedbackModal({
          open: true,
          title: "Walk-in patient added",
          message: `The patient record was created successfully. Unique ID: ${createdPatient.uniqueLoginId ?? "Not generated"}`,
          variant: "success",
        });

        if (walkInNextStep === "appointment") {
          navigate(
            `/app/appointments?action=create&patientId=${createdPatient.id}&source=internal`,
          );
        }
      }

      form.reset();
      setWalkInStepIndex(0);
      setEditingPatient(null);
      setWalkInNextStep("none");
      setIsWalkInModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the patient record.";

      setFeedbackModal({
        open: true,
        title: "Unable to add walk-in patient",
        message,
        variant: "error",
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

    setWalkInStepIndex((currentIndex) =>
      Math.min(currentIndex + 1, walkInSteps.length - 1),
    );
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
    const isConfirmed = window.confirm(
      `Delete ${patient.firstName} ${patient.lastName} from the patient registry?`,
    );
    if (!isConfirmed) {
      return;
    }

    try {
      await deletePatient.mutateAsync(patient.id);
      await createPatientActionLog.mutateAsync({
        action: "delete",
        actorId: profile?.id ?? "system",
        actorName: profile?.fullName ?? "System User",
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        summary: `Deleted the patient record and removed it from the registry list.`,
        fields: ["Patient record", "QR code", "Contact reference"],
      });
      setFeedbackModal({
        open: true,
        title: "Patient record deleted",
        message: "The patient record was removed successfully.",
        variant: "success",
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: "Unable to delete patient",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while deleting the patient record.",
        variant: "error",
      });
    }
  };

  const patientSummary = useMemo(
    () => ({
      online: patients.filter((p) => p.intakeSource === "online_registration")
        .length,
      walkIn: patients.filter((p) => p.intakeSource !== "online_registration")
        .length,
      visited: patients.filter((p) => p.visitStatus === "visited_clinic")
        .length,
      notVisited: patients.filter(
        (p) => p.visitStatus === "registered_no_visit",
      ).length,
    }),
    [patients],
  );

  return (
    <>
      <div className="space-y-5">
        {/* Page header */}
        <div className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90">
                <Users className="size-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Patient Management
                </p>
                <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
                  Unified Patient Registry
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Online registrations appear here automatically; walk-ins can
                  be encoded by staff during the visit.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {can("patients.manage") ? (
                <Button
                  className="gap-2 bg-emerald-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide hover:bg-emerald-700 ring-1 ring-emerald-700/20"
                  onClick={openWalkInModal}
                >
                  <UserRoundPlus className="size-4" />
                  Add walk-in patient
                </Button>
              ) : null}
              {can("patients.manage") ? (
                <Button
                  className="gap-2"
                  onClick={() => navigate("/app/patients/bulk")}
                  variant="secondary"
                >
                  <ClipboardPlus className="size-4" />
                  Bulk add patients
                </Button>
              ) : null}
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                to="/app/patients/logs"
              >
                <ClipboardList className="size-4" />
                View logs
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                to="/app/patients/scan"
              >
                <QrCode className="size-4" />
                Scan QR
              </Link>
              <div className={INTERNAL_SEARCH_INPUT_WRAP}>
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search patient, email, QR, unique ID..."
                  value={search}
                />
              </div>
            </div>
          </div>
          <div
            className={cn(
              INTERNAL_SURFACE_FOOTER,
              "flex flex-wrap items-center gap-2 px-6 py-2.5",
            )}
          >
            <span className="text-xs font-medium text-slate-500">
              {filteredPatients.length} patient
              {filteredPatients.length !== 1 ? "s" : ""} found
            </span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
              {patientSummary.online} online
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-100">
              {patientSummary.walkIn} walk-in
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
              {patientSummary.visited} visited
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
              {patientSummary.notVisited} not yet visited
            </span>
          </div>
        </div>

        {/* Table / empty state */}
        {filteredPatients.length === 0 ? (
          <div
            className={cn(
              INTERNAL_SURFACE,
              "flex flex-col items-center p-12 text-center",
            )}
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90">
              <UserRoundPlus className="size-6" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-bold text-slate-900">
              No patients found
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
              Online registrations and walk-in records will appear here once
              patients start entering the system.
            </p>
          </div>
        ) : (
          <div className={INTERNAL_SURFACE}>
            <div className={INTERNAL_TABLE_SCROLL}>
              <table className={INTERNAL_TABLE}>
                <thead>
                  <tr className={INTERNAL_THEAD_ROW}>
                    <th className={INTERNAL_TH}>Patient</th>
                    <th className={INTERNAL_TH}>Contact</th>
                    <th className={INTERNAL_TH}>Birth date</th>
                    <th className={INTERNAL_TH}>Source</th>
                    <th className={INTERNAL_TH}>Visit status</th>
                    <th className={INTERNAL_TH}>Unique ID</th>
                    <th className={INTERNAL_TH}>QR code</th>
                    <th className={cn(INTERNAL_TH, "text-right")}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.map((patient) => (
                    <tr className={INTERNAL_TR} key={patient.id}>
                      <td className={INTERNAL_TD}>
                        <div className="space-y-1">
                          <Link
                            className="font-semibold text-slate-900 hover:text-[var(--color-primary)] hover:underline"
                            to={`/app/patients/${patient.id}`}
                          >
                            {patient.firstName} {patient.lastName}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
                              {patient.bloodType || "Unspecified"}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                              {patient.sex}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={INTERNAL_TD}>
                        <div className="space-y-0.5 text-sm text-slate-600">
                          <p>{patient.email}</p>
                          <p>{patient.mobileNumber}</p>
                        </div>
                      </td>
                      <td className={INTERNAL_TD}>
                        <span className="text-sm text-slate-600">
                          {formatDateLabel(patient.birthDate)}
                        </span>
                      </td>
                      <td className={INTERNAL_TD}>
                        <span className="text-xs font-medium text-slate-500">
                          {getPatientSourceLabel(patient)}
                        </span>
                      </td>
                      <td className={INTERNAL_TD}>
                        {patient.visitStatus === "visited_clinic" ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                            Visited clinic
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                            Not visited yet
                          </span>
                        )}
                      </td>
                      <td className={INTERNAL_TD}>
                        <span className="font-mono text-xs text-slate-500">
                          {patient.uniqueLoginId || "—"}
                        </span>
                      </td>
                      <td className={INTERNAL_TD}>
                        <span className="font-mono text-xs text-slate-500">
                          {patient.qrCode || "—"}
                        </span>
                      </td>
                      <td className={INTERNAL_TD}>
                        <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                          {can("patients.manage") ? (
                            <button
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:underline"
                              onClick={() => openEditPatientModal(patient)}
                              type="button"
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </button>
                          ) : null}
                          {can("patients.manage") ? (
                            <button
                              className="inline-flex items-center gap-1 text-rose-600 hover:underline"
                              onClick={() => void handleDeletePatient(patient)}
                              type="button"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          ) : null}
                          <Link
                            className="inline-flex items-center text-[var(--color-primary)] hover:underline"
                            to={`/app/patients/${patient.id}`}
                          >
                            Open record
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredPatients.length > 0 ? (
              <div
                className={cn(
                  INTERNAL_SURFACE_FOOTER,
                  "flex flex-wrap items-center justify-between gap-3 px-6 py-3",
                )}
              >
                <p className="text-xs font-medium text-slate-500">
                  Showing {showingStart}–{showingEnd} of{" "}
                  {filteredPatients.length} patients
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className={INTERNAL_BTN_PAGE}
                    disabled={safeCurrentPage <= 1}
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    type="button"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-medium text-slate-500">
                    {safeCurrentPage} / {totalPages}
                  </span>
                  <button
                    className={INTERNAL_BTN_PAGE}
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Walk-in / edit modal */}
      {isWalkInModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeWalkInModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4 bg-emerald-600 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
                  Walk-In Intake
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {editingPatient
                    ? "Edit Patient Record"
                    : "Create Staff-Encoded Patient Record"}
                </p>
                <p className="mt-1.5 max-w-2xl text-sm text-emerald-50">
                  {editingPatient
                    ? "Update the most important patient details here. Only the key changed fields will be recorded in the patient logs."
                    : "Use this form for patients who arrive at the clinic without an existing portal account."}
                </p>
              </div>
              <button
                aria-label="Close walk-in patient modal"
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/20 p-2 text-white transition hover:bg-white/10"
                onClick={closeWalkInModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              {/* Step indicator */}
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                      Step {walkInStepIndex + 1} of {walkInSteps.length}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {currentStep.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {currentStep.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {walkInSteps.map((step, index) => (
                      <span
                        className={cn(
                          "h-2 w-8 rounded-full transition-colors",
                          index <= walkInStepIndex
                            ? "bg-[var(--color-primary)]"
                            : "bg-slate-200",
                        )}
                        key={step.id}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {currentStep.id === "personal" ? (
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField
                        error={form.formState.errors.firstName?.message}
                        label="First name"
                      >
                        <Input {...form.register("firstName")} />
                      </FormField>
                      <FormField
                        error={form.formState.errors.lastName?.message}
                        label="Last name"
                      >
                        <Input {...form.register("lastName")} />
                      </FormField>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField label="Sex">
                        <select
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                          {...form.register("sex")}
                        >
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="other">Other</option>
                        </select>
                      </FormField>
                      <FormField
                        error={form.formState.errors.birthDate?.message}
                        label="Birth date"
                      >
                        <Input type="date" {...form.register("birthDate")} />
                      </FormField>
                    </div>
                  </div>
                ) : null}

                {currentStep.id === "contact" ? (
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField
                        error={form.formState.errors.mobileNumber?.message}
                        label="Mobile number"
                      >
                        <Input
                          inputMode="numeric"
                          maxLength={11}
                          pattern="[0-9]*"
                          {...form.register("mobileNumber", {
                            setValueAs: (value) =>
                              sanitizeMobileNumber(String(value ?? "")),
                            onChange: (event) => {
                              const sanitized = sanitizeMobileNumber(
                                event.target.value,
                              );
                              if (sanitized !== event.target.value) {
                                event.target.value = sanitized;
                              }
                            },
                          })}
                        />
                      </FormField>
                      <FormField
                        error={form.formState.errors.email?.message}
                        label="Email"
                      >
                        <Input {...form.register("email")} />
                      </FormField>
                    </div>
                    <FormField
                      error={form.formState.errors.address?.message}
                      label="Address"
                    >
                      <Input {...form.register("address")} />
                    </FormField>
                  </div>
                ) : null}

                {currentStep.id === "medical" ? (
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField
                        error={form.formState.errors.bloodType?.message}
                        label="Blood type"
                      >
                        <select
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                          {...form.register("bloodType")}
                        >
                          <option value="">Select blood type</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </FormField>
                      <FormField
                        error={form.formState.errors.allergies?.message}
                        label="Allergies"
                      >
                        <Input {...form.register("allergies")} />
                      </FormField>
                    </div>
                    <FormField
                      error={form.formState.errors.medicalHistory?.message}
                      label="Medical history"
                    >
                      <Textarea {...form.register("medicalHistory")} />
                    </FormField>
                  </div>
                ) : null}

                {currentStep.id === "vitals" ? (
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField
                        error={form.formState.errors.temperature?.message}
                        label="Temperature (°C)"
                      >
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="e.g., 37.5"
                          {...form.register("temperature")}
                        />
                      </FormField>
                      <FormField
                        error={form.formState.errors.bloodPressure?.message}
                        label="Blood Pressure (mmHg)"
                      >
                        <Input
                          type="text"
                          placeholder="e.g., 120/80"
                          {...form.register("bloodPressure")}
                        />
                      </FormField>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField
                        error={form.formState.errors.heartRate?.message}
                        label="Heart Rate (bpm)"
                      >
                        <Input
                          type="number"
                          step="1"
                          placeholder="e.g., 72"
                          {...form.register("heartRate")}
                        />
                      </FormField>
                      <FormField
                        error={form.formState.errors.respiratoryRate?.message}
                        label="Respiratory Rate (breaths/min)"
                      >
                        <Input
                          type="number"
                          step="1"
                          placeholder="e.g., 16"
                          {...form.register("respiratoryRate")}
                        />
                      </FormField>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <FormField
                        error={form.formState.errors.o2Sat?.message}
                        label="O2sat (%)"
                      >
                        <Input
                          type="number"
                          step="1"
                          placeholder="e.g., 98"
                          {...form.register("o2Sat")}
                        />
                      </FormField>
                      <FormField
                        error={form.formState.errors.weight?.message}
                        label="Weight (kg)"
                      >
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="e.g., 70.5"
                          {...form.register("weight")}
                        />
                      </FormField>
                      <FormField
                        error={form.formState.errors.height?.message}
                        label="Height (cm)"
                      >
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="e.g., 170"
                          {...form.register("height")}
                        />
                      </FormField>
                    </div>
                  </div>
                ) : null}

                {currentStep.id === "emergency" ? (
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField
                        error={
                          form.formState.errors.emergencyContactName?.message
                        }
                        label="Contact name"
                      >
                        <Input {...form.register("emergencyContactName")} />
                      </FormField>
                      <FormField
                        error={
                          form.formState.errors.emergencyContactPhone?.message
                        }
                        label="Contact phone"
                      >
                        <Input
                          inputMode="numeric"
                          maxLength={11}
                          pattern="[0-9]*"
                          {...form.register("emergencyContactPhone", {
                            setValueAs: (value) =>
                              sanitizeMobileNumber(String(value ?? "")),
                            onChange: (event) => {
                              const sanitized = sanitizeMobileNumber(
                                event.target.value,
                              );
                              if (sanitized !== event.target.value) {
                                event.target.value = sanitized;
                              }
                            },
                          })}
                        />
                      </FormField>
                    </div>
                  </div>
                ) : null}
              </div>

              <div
                className={cn(
                  INTERNAL_SURFACE_FOOTER,
                  "flex flex-col-reverse gap-3 px-4 py-4 sm:flex-row sm:justify-end sm:px-6",
                )}
              >
                <Button
                  className="w-full sm:w-auto"
                  onClick={closeWalkInModal}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
                {walkInStepIndex > 0 ? (
                  <Button
                    className="w-full sm:w-auto"
                    onClick={goToPreviousStep}
                    type="button"
                    variant="secondary"
                  >
                    Back
                  </Button>
                ) : null}
                {isLastStep ? (
                  <Button
                    className="w-full bg-emerald-600 px-5 py-3 text-sm font-semibold uppercase tracking-wide hover:bg-emerald-700 sm:w-auto"
                    disabled={
                      createPatient.isPending || updatePatient.isPending
                    }
                    type="submit"
                  >
                    {createPatient.isPending || updatePatient.isPending
                      ? "Saving..."
                      : editingPatient
                        ? "Save Patient Changes"
                        : "Create Walk-In Patient"}
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-emerald-600 px-5 py-3 text-sm font-semibold uppercase tracking-wide hover:bg-emerald-700 sm:w-auto"
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
