import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardPlus, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { FeedbackModal } from "../../components/ui/feedback-modal";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  INTERNAL_SURFACE,
  INTERNAL_SURFACE_FOOTER,
} from "../../lib/internal-ui";
import { createPatientMedicalHistoryEntryLiveOrDemo } from "../../lib/supabase-clinic";
import { cn } from "../../lib/utils";
import { useDoctorDirectory } from "../../hooks/use-clinic-data";
import { useAuth } from "../auth/auth-context";
import { useCreatePatient } from "./hooks/use-patients";

const patientSchema = z
  .object({
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
      .regex(
        /^[\d]{11}$/,
        "Emergency contact phone must be exactly 11 digits.",
      ),
    temperature: z.string().optional(),
    bloodPressure: z.string().optional(),
    heartRate: z.string().optional(),
    o2Sat: z.string().optional(),
    respiratoryRate: z.string().optional(),
    weight: z.string().optional(),
    height: z.string().optional(),
    providerId: z.string().optional(),
    soapSubjective: z.string().optional(),
    soapObjective: z.string().optional(),
    soapAssessment: z.string().optional(),
    soapPlan: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasSoap = [
      value.soapSubjective,
      value.soapObjective,
      value.soapAssessment,
      value.soapPlan,
    ].some((entry) => Boolean(entry?.trim()));

    if (hasSoap && !value.providerId?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["providerId"],
        message: "Select a provider for SOAP notes.",
      });
    }
  });

type PatientFormValues = z.infer<typeof patientSchema>;

type BulkPatientFormValues = {
  patients: PatientFormValues[];
};

const bulkPatientSchema = z.object({
  patients: z.array(patientSchema).min(1, "Add at least one patient."),
});

const defaultPatientValues: PatientFormValues = {
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
  providerId: "",
  soapSubjective: "",
  soapObjective: "",
  soapAssessment: "",
  soapPlan: "",
};

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: "success" | "error";
}

interface BulkPatientError {
  index: number;
  name: string;
  message: string;
}

function sanitizeMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function sanitizeEmailToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildAutoEmail(firstName: string, lastName: string) {
  const firstToken = sanitizeEmailToken(firstName);
  const lastToken = sanitizeEmailToken(lastName);
  if (!firstToken || !lastToken) {
    return "";
  }

  return `${firstToken}${lastToken}@gmail.com`;
}

function getVitalsRecordedAt(values: PatientFormValues) {
  return values.temperature ||
    values.bloodPressure ||
    values.heartRate ||
    values.o2Sat ||
    values.respiratoryRate ||
    values.weight ||
    values.height
    ? new Date().toISOString()
    : null;
}

function hasSoapEntry(
  values: Pick<
    PatientFormValues,
    "soapSubjective" | "soapObjective" | "soapAssessment" | "soapPlan"
  >,
) {
  return [
    values.soapSubjective,
    values.soapObjective,
    values.soapAssessment,
    values.soapPlan,
  ].some((entry) => Boolean(entry?.trim()));
}

function buildSoapNotesText(
  values: Pick<
    PatientFormValues,
    "soapSubjective" | "soapObjective" | "soapAssessment" | "soapPlan"
  >,
) {
  return [
    `${values.soapSubjective?.trim() || "N/A"}`,
    `${values.soapObjective?.trim() || "N/A"}`,
    ` ${values.soapAssessment?.trim() || "N/A"}`,
    ` ${values.soapPlan?.trim() || "N/A"}`,
  ].join("\n");
}

export function PatientsBulkAddPage() {
  const { profile } = useAuth();
  const { data: doctors = [] } = useDoctorDirectory();
  const createPatient = useCreatePatient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<BulkPatientError[]>([]);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: "",
    message: "",
    variant: "success",
  });

  const form = useForm<BulkPatientFormValues>({
    resolver: zodResolver(bulkPatientSchema),
    defaultValues: {
      patients: [defaultPatientValues],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "patients",
  });
  const watchedPatients = useWatch({
    control: form.control,
    name: "patients",
  });
  const autoEmailById = useRef(new Map<string, string>());

  useEffect(() => {
    if (!watchedPatients) {
      return;
    }

    watchedPatients.forEach((patient, index) => {
      const fieldId = fields[index]?.id;
      if (!fieldId) {
        return;
      }

      const nextEmail = buildAutoEmail(
        patient?.firstName ?? "",
        patient?.lastName ?? "",
      );
      if (!nextEmail) {
        return;
      }

      const currentEmail = patient?.email?.trim() ?? "";
      const previousAuto = autoEmailById.current.get(fieldId);
      const shouldUpdate = !currentEmail || currentEmail === previousAuto;

      if (shouldUpdate && currentEmail !== nextEmail) {
        form.setValue(`patients.${index}.email`, nextEmail, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      autoEmailById.current.set(fieldId, nextEmail);
    });
  }, [fields, form, watchedPatients]);

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setBulkErrors([]);

    const errors: BulkPatientError[] = [];
    const failedIndexes = new Set<number>();

    for (let index = 0; index < values.patients.length; index += 1) {
      const patient = values.patients[index];
      const patientName = `${patient.firstName} ${patient.lastName}`.trim();
      const {
        providerId,
        soapSubjective,
        soapObjective,
        soapAssessment,
        soapPlan,
        ...patientValues
      } = patient;
      const createdSoapNotes = hasSoapEntry({
        soapSubjective,
        soapObjective,
        soapAssessment,
        soapPlan,
      });
      let createdPatientId: string | null = null;

      try {
        const createdPatient = await createPatient.mutateAsync({
          ...patientValues,
          userId: null,
          qrCode: "",
          intakeSource: "staff_walk_in",
          visitStatus: "visited_clinic",
          vitalsRecordedAt: getVitalsRecordedAt(patientValues),
        });
        createdPatientId = createdPatient.id;

        if (createdSoapNotes) {
          await createPatientMedicalHistoryEntryLiveOrDemo({
            patientId: createdPatient.id,
            providerId: providerId?.trim() || null,
            actor: profile?.id ?? null,
            historyText: "",
            findingsText: "",
            diagnosesText: "",
            treatmentSummaryText: "",
            soapNotesText: buildSoapNotesText({
              soapSubjective,
              soapObjective,
              soapAssessment,
              soapPlan,
            }),
            supplementaryDocsText: "",
            appointmentId: null,
            consultationId: null,
          });
        }
      } catch (error) {
        errors.push({
          index,
          name: patientName || `Patient ${index + 1}`,
          message:
            error instanceof Error
              ? error.message
              : "Something went wrong while adding this patient.",
        });
        if (!createdPatientId) {
          failedIndexes.add(index);
        }
      }
    }

    setBulkErrors(errors);

    const successCount = values.patients.length - errors.length;
    if (errors.length === 0) {
      form.reset({ patients: [defaultPatientValues] });
      setFeedbackModal({
        open: true,
        title: "Bulk patient intake complete",
        message: `Added ${successCount} patient${successCount !== 1 ? "s" : ""} successfully.`,
        variant: "success",
      });
    } else {
      const remainingPatients = values.patients.filter((_, index) =>
        failedIndexes.has(index),
      );
      replace(
        remainingPatients.length > 0
          ? remainingPatients
          : [defaultPatientValues],
      );
      setFeedbackModal({
        open: true,
        title: "Bulk patient intake needs attention",
        message: `Added ${successCount} of ${values.patients.length} patients. Review the errors below and try again.`,
        variant: "error",
      });
    }

    setIsSubmitting(false);
  });

  return (
    <div className="space-y-5">
      <div className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-[var(--color-primary)] ring-1 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]">
              <Users className="size-5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Patient Management
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
                Adding Bulk Patient
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Add multiple walk-in patients at once. Each row creates a new
                patient record.
              </p>
            </div>
          </div>
          <Button
            className="gap-2"
            onClick={() => append({ ...defaultPatientValues })}
            type="button"
          >
            <Plus className="size-4" />
            Add another patient
          </Button>
        </div>
        <div className={cn(INTERNAL_SURFACE_FOOTER, "px-6 py-3")}>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <ClipboardPlus className="size-4" />
            {fields.length} patient{fields.length !== 1 ? "s" : ""} in this
            batch
          </div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {fields.map((field, index) => (
          <div
            className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,41,71,0.04),0_8px_28px_-8px_rgba(15,41,71,0.09)]"
            key={field.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100/90 bg-slate-50/80 px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Patient {index + 1}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Patient details
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  First name: {watchedPatients?.[index]?.firstName || "—"} ·
                  Last name: {watchedPatients?.[index]?.lastName || "—"} ·
                  Email:{" "}
                  {watchedPatients?.[index]?.email ||
                    buildAutoEmail(
                      watchedPatients?.[index]?.firstName ?? "",
                      watchedPatients?.[index]?.lastName ?? "",
                    ) ||
                    "—"}
                </p>
              </div>
              <Button
                className="gap-2"
                disabled={fields.length <= 1}
                onClick={() => remove(index)}
                type="button"
                variant="secondary"
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.firstName?.message
                  }
                  label="First name"
                >
                  <Input {...form.register(`patients.${index}.firstName`)} />
                </FormField>
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.lastName?.message
                  }
                  label="Last name"
                >
                  <Input {...form.register(`patients.${index}.lastName`)} />
                </FormField>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <FormField label="Sex">
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    {...form.register(`patients.${index}.sex`)}
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </FormField>
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.birthDate?.message
                  }
                  label="Birth date"
                >
                  <Input
                    type="date"
                    {...form.register(`patients.${index}.birthDate`)}
                  />
                </FormField>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.mobileNumber
                      ?.message
                  }
                  label="Mobile number"
                >
                  <Input
                    inputMode="numeric"
                    maxLength={11}
                    pattern="[0-9]*"
                    {...form.register(`patients.${index}.mobileNumber`, {
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
                  error={
                    form.formState.errors.patients?.[index]?.email?.message
                  }
                  label="Email"
                >
                  <Input {...form.register(`patients.${index}.email`)} />
                </FormField>
              </div>

              <FormField
                error={
                  form.formState.errors.patients?.[index]?.address?.message
                }
                label="Address"
              >
                <Input {...form.register(`patients.${index}.address`)} />
              </FormField>

              <div className="grid gap-4 lg:grid-cols-2">
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.bloodType?.message
                  }
                  label="Blood type"
                >
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    {...form.register(`patients.${index}.bloodType`)}
                  >
                    <option value="">Select blood type</option>
                    <option value="O+">N/A</option>
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
                  error={
                    form.formState.errors.patients?.[index]?.allergies?.message
                  }
                  label="Allergies"
                >
                  <Input {...form.register(`patients.${index}.allergies`)} />
                </FormField>
              </div>

              <FormField
                error={
                  form.formState.errors.patients?.[index]?.medicalHistory
                    ?.message
                }
                label="Medical history"
              >
                <Textarea
                  {...form.register(`patients.${index}.medicalHistory`)}
                />
              </FormField>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  SOAP Notes
                </p>
                <div className="mt-3 space-y-4">
                  <FormField
                    error={
                      form.formState.errors.patients?.[index]?.providerId
                        ?.message
                    }
                    label="Provider"
                  >
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                      {...form.register(`patients.${index}.providerId`)}
                    >
                      <option value="">Select provider</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.fullName}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Subjective">
                      <Textarea
                        rows={3}
                        placeholder="Subjective notes"
                        {...form.register(`patients.${index}.soapSubjective`)}
                      />
                    </FormField>
                    <FormField label="Objective">
                      <Textarea
                        rows={3}
                        placeholder="Objective notes"
                        {...form.register(`patients.${index}.soapObjective`)}
                      />
                    </FormField>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Assessment">
                      <Textarea
                        rows={3}
                        placeholder="Assessment notes"
                        {...form.register(`patients.${index}.soapAssessment`)}
                      />
                    </FormField>
                    <FormField label="Plan">
                      <Textarea
                        rows={3}
                        placeholder="Plan notes"
                        {...form.register(`patients.${index}.soapPlan`)}
                      />
                    </FormField>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.temperature
                      ?.message
                  }
                  label="Temperature (C)"
                >
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 37.5"
                    {...form.register(`patients.${index}.temperature`)}
                  />
                </FormField>
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.bloodPressure
                      ?.message
                  }
                  label="Blood Pressure (mmHg)"
                >
                  <Input
                    type="text"
                    placeholder="e.g., 120/80"
                    {...form.register(`patients.${index}.bloodPressure`)}
                  />
                </FormField>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.heartRate?.message
                  }
                  label="Heart Rate (bpm)"
                >
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g., 72"
                    {...form.register(`patients.${index}.heartRate`)}
                  />
                </FormField>
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.respiratoryRate
                      ?.message
                  }
                  label="Respiratory Rate (breaths/min)"
                >
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g., 16"
                    {...form.register(`patients.${index}.respiratoryRate`)}
                  />
                </FormField>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.o2Sat?.message
                  }
                  label="O2sat (%)"
                >
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g., 98"
                    {...form.register(`patients.${index}.o2Sat`)}
                  />
                </FormField>
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.weight?.message
                  }
                  label="Weight (kg)"
                >
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 70.5"
                    {...form.register(`patients.${index}.weight`)}
                  />
                </FormField>
                <FormField
                  error={
                    form.formState.errors.patients?.[index]?.height?.message
                  }
                  label="Height (cm)"
                >
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 170"
                    {...form.register(`patients.${index}.height`)}
                  />
                </FormField>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <FormField
                  error={
                    form.formState.errors.patients?.[index]
                      ?.emergencyContactName?.message
                  }
                  label="Contact name"
                >
                  <Input
                    {...form.register(`patients.${index}.emergencyContactName`)}
                  />
                </FormField>
                <FormField
                  error={
                    form.formState.errors.patients?.[index]
                      ?.emergencyContactPhone?.message
                  }
                  label="Contact phone"
                >
                  <Input
                    inputMode="numeric"
                    maxLength={11}
                    pattern="[0-9]*"
                    {...form.register(
                      `patients.${index}.emergencyContactPhone`,
                      {
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
                      },
                    )}
                  />
                </FormField>
              </div>
            </div>
          </div>
        ))}

        {bulkErrors.length > 0 ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
              Patients with errors
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {bulkErrors.map((error) => (
                <li key={`${error.index}-${error.message}`}>
                  {error.name}: {error.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          className={cn(
            INTERNAL_SURFACE_FOOTER,
            "flex flex-col-reverse gap-3 rounded-2xl border border-slate-200/90 bg-white px-6 py-4 shadow-[0_1px_2px_rgba(15,41,71,0.04),0_8px_28px_-8px_rgba(15,41,71,0.09)] sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <Button
            className="gap-2"
            onClick={() => append({ ...defaultPatientValues })}
            type="button"
            variant="secondary"
          >
            <Plus className="size-4" />
            Add another patient
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Saving..." : "Save All Patients"}
          </Button>
        </div>
      </form>

      <FeedbackModal
        autoCloseMs={3000}
        message={feedbackModal.message}
        onClose={closeFeedbackModal}
        open={feedbackModal.open}
        title={feedbackModal.title}
        variant={feedbackModal.variant}
      />
    </div>
  );
}
