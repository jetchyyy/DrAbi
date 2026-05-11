import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { useAuth } from "../auth/auth-context";
import {
  useDoctorDirectory,
  useServicesCatalog,
  useSpecialtiesCatalog,
} from "../../hooks/use-clinic-data";
import { useCreateAppointment } from "../appointments/hooks/use-appointments";
import { useAppointments } from "../appointments/hooks/use-appointments";
import {
  useBookings,
  useCreateInvoice,
} from "../billing/api/billing-mutations";
import { useCreatePatient } from "../patients/hooks/use-patients";
import { usePatients } from "../patients/hooks/use-patients";
import { useUpdatePatient } from "../patients/hooks/use-patients";
import { useUpdateAppointment } from "../appointments/hooks/use-appointments";
import {
  formatCurrency,
  getPhilippineDateKey,
  getPhilippineTimeKey,
} from "../../lib/utils";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { openQueuePrint } from "../appointments/components/appointments-que";
import type { Appointment, Patient } from "../../types/domain";

const walkInWizardSchema = z.object({
  patient: z.object({
    firstName: z.string().min(2, "First name is required."),
    lastName: z.string().min(2, "Last name is required."),
    sex: z.enum(["male", "female", "other"]),
    birthDate: z.string().min(1, "Birth date is required."),
    mobileNumber: z.string().min(5, "Mobile number is required."),
    email: z.string().email("Enter a valid email address."),
    address: z.string().min(4, "Address is required."),
    bloodType: z.string().min(1, "Blood type is required."),
    allergies: z.string().min(1, "Allergies are required."),
    medicalHistory: z.string().min(1, "Medical history is required."),
    emergencyContactName: z.string().min(2, "Emergency contact is required."),
    emergencyContactPhone: z
      .string()
      .min(5, "Emergency contact phone is required."),
    temperature: z.string().optional(),
    bloodPressure: z.string().optional(),
    heartRate: z.string().optional(),
    o2Sat: z.string().optional(),
    respiratoryRate: z.string().optional(),
    weight: z.string().optional(),
    height: z.string().optional(),
  }),
  appointment: z.object({
    doctorId: z.string().min(1, "Doctor is required."),
    specialtyId: z.string().optional(),
    serviceId: z.string().min(1, "Service is required."),
    status: z.enum(["scheduled", "confirmed", "in_progress", "completed"]),
    source: z.enum(["internal", "portal"]),
    visitType: z.enum(["in_person", "teleconsultation"]),
    scheduledAt: z.string().min(1, "Schedule is required."),
    reason: z.string().min(4, "Reason is required."),
    notes: z.string().min(2, "Notes are required."),
  }),
  billing: z
    .object({
      patientId: z.string().min(1, "Patient is required."),
      bookingId: z.string().optional(),
      appointmentId: z.string().optional(),
      paymentType: z.enum(["cash", "gcash", "card"]),
      referenceNumber: z.string().optional(),
      paymentStatus: z.enum(["unpaid", "paid"]),
      items: z
        .array(
          z.object({
            description: z.string().min(2, "Description is required."),
            category: z.enum([
              "consultation",
              "laboratory",
              "medicine",
              "other",
            ]),
            quantity: z.number().min(1, "Quantity is required."),
            unitPrice: z.number().min(1, "Unit price is required."),
          }),
        )
        .min(1, "At least one line item is required."),
    })
    .superRefine((value, context) => {
      if (
        value.paymentStatus === "paid" &&
        (value.paymentType === "gcash" || value.paymentType === "card") &&
        !value.referenceNumber?.trim()
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["referenceNumber"],
          message: "Reference number is required for GCash and Card payments.",
        });
      }
    }),
});

type WalkInWizardFormValues = z.infer<typeof walkInWizardSchema>;

type WalkInWizardStage = "patient" | "appointment" | "billing" | "complete";

function getDefaultWalkInScheduledAtValue() {
  return `${getPhilippineDateKey()}T${getPhilippineTimeKey().slice(0, 5)}`;
}

export function WalkInWizardModal({
  open,
  onClose,
  initialStage = "patient",
}: {
  open: boolean;
  onClose: () => void;
  initialStage?: WalkInWizardStage;
}) {
  const { profile } = useAuth();
  const { data: appointments = [] } = useAppointments();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: specialties = [] } = useSpecialtiesCatalog();
  const { data: services = [] } = useServicesCatalog();
  const { data: bookings = [] } = useBookings();
  const { data: patients = [] } = usePatients();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const createAppointment = useCreateAppointment();
  const createInvoice = useCreateInvoice();
  const updateAppointment = useUpdateAppointment();
  const [stage, setStage] = useState<WalkInWizardStage>(initialStage);
  const [existingPatientSearch, setExistingPatientSearch] = useState("");
  const [isExistingPatientDropdownOpen, setIsExistingPatientDropdownOpen] =
    useState(false);
  const [selectedExistingPatientId, setSelectedExistingPatientId] = useState<
    string | null
  >(null);
  const [invoicePatientSearch, setInvoicePatientSearch] = useState("");
  const [isInvoicePatientDropdownOpen, setIsInvoicePatientDropdownOpen] =
    useState(false);
  const [createdPatient, setCreatedPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const [createdAppointment, setCreatedAppointment] =
    useState<Appointment | null>(null);

  const defaultDoctor = doctors[0];
  const defaultService = services[0];
  const defaultSpecialtyId =
    defaultDoctor?.specialtyId ?? specialties[0]?.id ?? "";

  const form = useForm<WalkInWizardFormValues>({
    resolver: zodResolver(walkInWizardSchema),
    defaultValues: {
      patient: {
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
      appointment: {
        doctorId: defaultDoctor?.id ?? "",
        specialtyId: defaultSpecialtyId,
        serviceId: defaultService?.id ?? "",
        status: "confirmed",
        source: "internal",
        visitType: "in_person",
        scheduledAt: getDefaultWalkInScheduledAtValue(),
        reason: "Walk-in consultation",
        notes: "Front desk walk-in flow",
      },
      billing: {
        patientId: "",
        bookingId: "",
        appointmentId: "",
        paymentType: "cash",
        referenceNumber: "",
        paymentStatus: "paid",
        items: [
          {
            description: "General Consultation",
            category: "consultation",
            quantity: 1,
            unitPrice:
              defaultService?.price ?? defaultDoctor?.consultationFee ?? 800,
          },
        ],
      },
    },
  });
  const billingItems = useFieldArray({
    control: form.control,
    name: "billing.items",
  });

  const selectedDoctorId = form.watch("appointment.doctorId");
  const selectedServiceId = form.watch("appointment.serviceId");
  const selectedBillingPaymentStatus = form.watch("billing.paymentStatus");
  const selectedBillingPatientId = form.watch("billing.patientId");
  const billingLineItems = form.watch("billing.items");
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;
  const selectedDoctor =
    doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const filteredInvoicePatients = useMemo(() => {
    const query = invoicePatientSearch.trim().toLowerCase();

    if (!query) {
      return patients;
    }

    return patients.filter((patient) =>
      `${patient.firstName} ${patient.lastName} ${patient.email} ${patient.mobileNumber}`
        .toLowerCase()
        .includes(query),
    );
  }, [invoicePatientSearch, patients]);
  const selectedExistingPatient = useMemo(
    () =>
      selectedExistingPatientId
        ? (patients.find(
            (patient) => patient.id === selectedExistingPatientId,
          ) ?? null)
        : null,
    [patients, selectedExistingPatientId],
  );
  const isUsingExistingPatient = Boolean(selectedExistingPatient);
  const filteredExistingPatients = useMemo(() => {
    const query = existingPatientSearch.trim().toLowerCase();

    if (!query) {
      return patients;
    }

    return patients.filter((patient) =>
      `${patient.firstName} ${patient.lastName} ${patient.mobileNumber} ${patient.email}`
        .toLowerCase()
        .includes(query),
    );
  }, [existingPatientSearch, patients]);

  const applyExistingPatientToForm = (patient: Patient) => {
    form.setValue("patient.firstName", patient.firstName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.lastName", patient.lastName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.sex", patient.sex, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.birthDate", patient.birthDate, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.mobileNumber", patient.mobileNumber, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.email", patient.email, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.address", patient.address, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.bloodType", patient.bloodType, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.allergies", patient.allergies, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.medicalHistory", patient.medicalHistory, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(
      "patient.emergencyContactName",
      patient.emergencyContactName,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue(
      "patient.emergencyContactPhone",
      patient.emergencyContactPhone,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue("patient.temperature", patient.temperature ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.bloodPressure", patient.bloodPressure ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.heartRate", patient.heartRate ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.o2Sat", patient.o2Sat ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.respiratoryRate", patient.respiratoryRate ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.weight", patient.weight ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.height", patient.height ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextSpecialtyId =
      selectedService?.specialtyId ?? selectedDoctor?.specialtyId ?? "";
    if (
      nextSpecialtyId &&
      form.getValues("appointment.specialtyId") !== nextSpecialtyId
    ) {
      form.setValue("appointment.specialtyId", nextSpecialtyId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [form, open, selectedDoctor?.specialtyId, selectedService?.specialtyId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      patient: {
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
      appointment: {
        doctorId: defaultDoctor?.id ?? "",
        specialtyId: defaultSpecialtyId,
        serviceId: defaultService?.id ?? "",
        status: "confirmed",
        source: "internal",
        visitType: "in_person",
        scheduledAt: getDefaultWalkInScheduledAtValue(),
        reason: "Walk-in consultation",
        notes: "Front desk walk-in flow",
      },
      billing: {
        patientId: "",
        bookingId: "",
        appointmentId: "",
        paymentType: "cash",
        referenceNumber: "",
        paymentStatus: "paid",
        items: [
          {
            description: defaultService?.name ?? "General Consultation",
            category: "consultation",
            quantity: 1,
            unitPrice:
              defaultService?.price ?? defaultDoctor?.consultationFee ?? 800,
          },
        ],
      },
    });
    setStage(initialStage);
    setExistingPatientSearch("");
    setIsExistingPatientDropdownOpen(false);
    setSelectedExistingPatientId(null);
    setCreatedPatient(null);
    setCreatedAppointment(null);
  }, [
    defaultDoctor?.id,
    defaultDoctor?.specialtyId,
    defaultService?.id,
    defaultService?.specialtyId,
    form,
    initialStage,
    open,
  ]);

  if (!open) {
    return null;
  }

  const stepIndex =
    stage === "patient"
      ? 0
      : stage === "appointment"
        ? 1
        : stage === "billing"
          ? 2
          : 3;
  const stepLabels = ["Add patient", "Queue patient", "Billing", "Ready"];

  const closeModal = () => {
    if (
      createPatient.isPending ||
      createAppointment.isPending ||
      createInvoice.isPending ||
      updateAppointment.isPending
    ) {
      return;
    }

    onClose();
  };

  const handlePatientStep = async () => {
    if (selectedExistingPatientId) {
      const existingPatient = patients.find(
        (patient) => patient.id === selectedExistingPatientId,
      );

      if (!existingPatient) {
        toast.error("Selected existing patient record is no longer available.");
        return;
      }

      const values = form.getValues("patient");
      const hasUpdatedVitals = Boolean(
        values.temperature ||
        values.bloodPressure ||
        values.heartRate ||
        values.o2Sat ||
        values.respiratoryRate ||
        values.weight ||
        values.height,
      );

      await updatePatient.mutateAsync({
        patientId: existingPatient.id,
        payload: {
          userId: existingPatient.userId ?? null,
          qrCode: existingPatient.qrCode,
          intakeSource: existingPatient.intakeSource,
          visitStatus: existingPatient.visitStatus,
          lastClinicVisitAt: existingPatient.lastClinicVisitAt ?? null,
          firstName: existingPatient.firstName,
          lastName: existingPatient.lastName,
          sex: existingPatient.sex,
          birthDate: existingPatient.birthDate,
          mobileNumber: existingPatient.mobileNumber,
          email: existingPatient.email,
          address: existingPatient.address,
          bloodType: existingPatient.bloodType,
          allergies: existingPatient.allergies,
          medicalHistory: existingPatient.medicalHistory,
          emergencyContactName: existingPatient.emergencyContactName,
          emergencyContactPhone: existingPatient.emergencyContactPhone,
          temperature: values.temperature,
          bloodPressure: values.bloodPressure,
          heartRate: values.heartRate,
          o2Sat: values.o2Sat,
          respiratoryRate: values.respiratoryRate,
          weight: values.weight,
          height: values.height,
          vitalsRecordedAt: hasUpdatedVitals
            ? new Date().toISOString()
            : (existingPatient.vitalsRecordedAt ?? null),
        },
      });

      setCreatedPatient({
        id: existingPatient.id,
        firstName: existingPatient.firstName,
        lastName: existingPatient.lastName,
      });
      form.setValue("billing.patientId", existingPatient.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setInvoicePatientSearch(
        `${existingPatient.firstName} ${existingPatient.lastName}`,
      );
      setStage("appointment");
      toast.success(
        "Existing patient selected. Vitals updated for this visit.",
      );
      return;
    }

    const isValid = await form.trigger("patient");
    if (!isValid) {
      return;
    }

    const values = form.getValues("patient");
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

    const patient = await createPatient.mutateAsync({
      userId: null,
      qrCode: "",
      intakeSource: "staff_walk_in",
      visitStatus: "visited_clinic",
      lastClinicVisitAt: new Date().toISOString(),
      firstName: values.firstName,
      lastName: values.lastName,
      sex: values.sex,
      birthDate: values.birthDate,
      mobileNumber: values.mobileNumber,
      email: values.email,
      address: values.address,
      bloodType: values.bloodType,
      allergies: values.allergies,
      medicalHistory: values.medicalHistory,
      emergencyContactName: values.emergencyContactName,
      emergencyContactPhone: values.emergencyContactPhone,
      temperature: values.temperature,
      bloodPressure: values.bloodPressure,
      heartRate: values.heartRate,
      o2Sat: values.o2Sat,
      respiratoryRate: values.respiratoryRate,
      weight: values.weight,
      height: values.height,
      vitalsRecordedAt,
    });

    setCreatedPatient({
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
    });
    form.setValue("billing.patientId", patient.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setInvoicePatientSearch(`${patient.firstName} ${patient.lastName}`);
    setStage("appointment");
    toast.success("Patient added. Continue to appointment setup.");
  };

  const handleAppointmentStep = async () => {
    if (!createdPatient) {
      toast.error("Please complete patient intake first.");
      return;
    }

    const isValid = await form.trigger("appointment");
    if (!isValid) {
      return;
    }

    const values = form.getValues("appointment");
    const resolvedSpecialtyId =
      values.specialtyId ||
      selectedService?.specialtyId ||
      selectedDoctor?.specialtyId ||
      defaultSpecialtyId ||
      specialties[0]?.id ||
      "";

    let queueNumber = "ODC-QUE-000001";
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("appointments")
          .select("queue_number")
          .not("queue_number", "is", null)
          .order("created_at", { ascending: false })
          .limit(1);
        const latest = (data ?? []) as Array<{
          queue_number: string | null;
        }>;
        if (!error && latest && latest.length > 0 && latest[0].queue_number) {
          const m = String(latest[0].queue_number).match(/(\d+)$/);
          const next = m ? Number(m[1]) + 1 : 1;
          queueNumber = `ODC-QUE-${String(next).padStart(6, "0")}`;
        }
      } else {
        const stored = Number(localStorage.getItem("odc_queue_seq") || "0");
        const next = stored + 1;
        localStorage.setItem("odc_queue_seq", String(next));
        queueNumber = `ODC-QUE-${String(next).padStart(6, "0")}`;
      }
    } catch {
      const stored = Number(localStorage.getItem("odc_queue_seq") || "0");
      const next = stored + 1;
      localStorage.setItem("odc_queue_seq", String(next));
      queueNumber = `ODC-QUE-${String(next).padStart(6, "0")}`;
    }

    const scheduledAtUtc = new Date().toISOString();
    const scheduledDate = new Date(scheduledAtUtc);
    const minutes = scheduledDate.getMinutes();
    const estimatedEndDate = new Date(scheduledDate);

    if (minutes < 15) {
      estimatedEndDate.setMinutes(30, 0, 0);
    } else if (minutes >= 30) {
      estimatedEndDate.setHours(estimatedEndDate.getHours() + 1);
      estimatedEndDate.setMinutes(0, 0, 0);
    } else {
      estimatedEndDate.setMinutes(30, 0, 0);
    }

    const estimatedEnd = estimatedEndDate.toISOString();

    const appointment = await createAppointment.mutateAsync({
      patientId: createdPatient.id,
      doctorId: values.doctorId,
      specialtyId: resolvedSpecialtyId,
      serviceId: values.serviceId,
      scheduledAt: scheduledAtUtc,
      status: values.status,
      source: values.source,
      visitType: values.visitType,
      reason: values.reason,
      notes: values.notes,
      teleconsultationPlatform: undefined,
      teleconsultationUrl: undefined,
      teleconsultationAccessInstructions: undefined,
      queue_number: queueNumber,
      estimated_end: estimatedEnd,
    });

    setCreatedAppointment(appointment);
    form.setValue("billing.appointmentId", appointment.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("billing.patientId", createdPatient.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("billing.bookingId", "", {
      shouldDirty: false,
      shouldValidate: false,
    });
    setInvoicePatientSearch(
      `${createdPatient.firstName} ${createdPatient.lastName}`,
    );
    setStage("billing");
    toast.success("Appointment created. Continue to billing.");
  };

  const handleBillingStep = async () => {
    if (!createdPatient || !createdAppointment) {
      toast.error("Please complete the earlier steps first.");
      return;
    }

    const isValid = await form.trigger("billing");
    if (!isValid) {
      return;
    }

    const values = form.getValues("billing");
    await createInvoice.mutateAsync({
      values: {
        patientId: values.patientId,
        bookingId: values.bookingId ?? "",
        appointmentId: values.appointmentId ?? createdAppointment.id,
        items: values.items,
        paymentStatus: values.paymentStatus,
        paymentType: values.paymentType,
        referenceNumber: values.referenceNumber,
      },
      bookings,
      profile,
    });

    await updateAppointment.mutateAsync({
      appointmentId: createdAppointment.id,
      payload: {
        patientId: createdAppointment.patientId,
        doctorId: createdAppointment.doctorId,
        specialtyId: createdAppointment.specialtyId,
        serviceId: createdAppointment.serviceId,
        scheduledAt: createdAppointment.scheduledAt,
        queue_number: createdAppointment.queue_number ?? null,
        estimated_end: createdAppointment.estimated_end ?? null,
        status: "in_progress",
        source: createdAppointment.source,
        visitType: createdAppointment.visitType,
        reason: createdAppointment.reason,
        notes: createdAppointment.notes,
        teleconsultationPlatform:
          createdAppointment.teleconsultationPlatform ?? undefined,
        teleconsultationUrl:
          createdAppointment.teleconsultationUrl ?? undefined,
        teleconsultationAccessInstructions:
          createdAppointment.teleconsultationAccessInstructions ?? undefined,
      },
    });

    openQueuePrint({
      queueNumber: createdAppointment.queue_number ?? "ODC-QUE-000001",
      scheduledAt: createdAppointment.scheduledAt,
      estimatedEnd:
        createdAppointment.estimated_end ?? createdAppointment.scheduledAt,
      patientName: createdPatient
        ? `${createdPatient.firstName} ${createdPatient.lastName}`
        : undefined,
    });

    setStage("complete");
    toast.success("Billing completed. The patient is ready for consultation.");
  };

  const isBusy =
    createPatient.isPending ||
    updatePatient.isPending ||
    createAppointment.isPending ||
    createInvoice.isPending ||
    updateAppointment.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-slate-950 px-6 py-5 text-white">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-orange-300">
              Front Desk Walk-In Flow
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              One modal, one patient, full handoff
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Add the patient, set the appointment, bill immediately, and send
              them ready for consultation without leaving this page.
            </p>
          </div>
          <button
            className="border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={closeModal}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="grid grid-cols-4 gap-2">
            {stepLabels.map((label, index) => {
              const active = index <= stepIndex;

              return (
                <div className="min-w-0" key={label}>
                  <div
                    className={`h-2 w-full ${active ? "bg-orange-600" : "bg-slate-200"}`}
                  />
                  <p
                    className={`mt-2 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] ${
                      active ? "text-orange-700" : "text-slate-400"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {stage === "patient" ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  Existing patient search
                </p>
                <div className="relative mt-3">
                  <Input
                    onBlur={() => {
                      window.setTimeout(
                        () => setIsExistingPatientDropdownOpen(false),
                        120,
                      );
                    }}
                    onFocus={() => setIsExistingPatientDropdownOpen(true)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setExistingPatientSearch(value);
                      setIsExistingPatientDropdownOpen(true);
                      setSelectedExistingPatientId(null);
                    }}
                    placeholder="Search existing patient by name, mobile, or email"
                    value={existingPatientSearch}
                  />
                  {isExistingPatientDropdownOpen ? (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg">
                      {filteredExistingPatients.length > 0 ? (
                        filteredExistingPatients.slice(0, 20).map((patient) => (
                          <button
                            className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${selectedExistingPatientId === patient.id ? "bg-orange-50 text-orange-800" : "text-slate-700"}`}
                            key={patient.id}
                            onMouseDown={() => {
                              setSelectedExistingPatientId(patient.id);
                              setExistingPatientSearch(
                                `${patient.firstName} ${patient.lastName}`,
                              );
                              setIsExistingPatientDropdownOpen(false);
                              applyExistingPatientToForm(patient);
                            }}
                            type="button"
                          >
                            {patient.firstName} {patient.lastName}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          No matching patient found.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                {selectedExistingPatientId ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                    <p className="text-xs font-semibold text-orange-800">
                      Using existing patient record.
                    </p>
                    <button
                      className="text-xs font-bold uppercase tracking-widest text-orange-700 hover:underline"
                      onClick={() => {
                        setSelectedExistingPatientId(null);
                        setExistingPatientSearch("");
                        form.resetField("patient");
                      }}
                      type="button"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
                {selectedExistingPatient ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                      Existing record warning
                    </p>
                    <p className="text-xs text-amber-900">
                      Demographics and profile details are locked to protect the
                      existing record. Only vitals will be updated in this
                      workflow.
                    </p>
                    <div className="grid gap-2 text-xs text-amber-900 sm:grid-cols-2">
                      <p>
                        <span className="font-semibold">Patient:</span>{" "}
                        {selectedExistingPatient.firstName}{" "}
                        {selectedExistingPatient.lastName}
                      </p>
                      <p>
                        <span className="font-semibold">Mobile:</span>{" "}
                        {selectedExistingPatient.mobileNumber}
                      </p>
                      <p>
                        <span className="font-semibold">Email:</span>{" "}
                        {selectedExistingPatient.email}
                      </p>
                      <p>
                        <span className="font-semibold">Address:</span>{" "}
                        {selectedExistingPatient.address}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={form.formState.errors.patient?.firstName?.message}
                  label="First name"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.firstName")}
                  />
                </FormField>
                <FormField
                  error={form.formState.errors.patient?.lastName?.message}
                  label="Last name"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.lastName")}
                  />
                </FormField>
                <FormField label="Sex">
                  <select
                    className="w-full border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.sex")}
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </FormField>
                <FormField
                  error={form.formState.errors.patient?.birthDate?.message}
                  label="Birth date"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    type="date"
                    {...form.register("patient.birthDate")}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={form.formState.errors.patient?.mobileNumber?.message}
                  label="Mobile number"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.mobileNumber")}
                  />
                </FormField>
                <FormField
                  error={form.formState.errors.patient?.email?.message}
                  label="Email"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.email")}
                  />
                </FormField>
              </div>
              <FormField
                error={form.formState.errors.patient?.address?.message}
                label="Address"
              >
                <Input
                  disabled={isUsingExistingPatient}
                  {...form.register("patient.address")}
                />
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={form.formState.errors.patient?.bloodType?.message}
                  label="Blood type"
                >
                  <Select
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.bloodType")}
                  >
                    <option value="">Select blood type</option>
                    <option value="N/A">N/A</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </Select>
                </FormField>
                <FormField
                  error={form.formState.errors.patient?.allergies?.message}
                  label="Allergies"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.allergies")}
                  />
                </FormField>
              </div>
              <FormField
                error={form.formState.errors.patient?.medicalHistory?.message}
                label="Medical history"
              >
                <Textarea
                  disabled={isUsingExistingPatient}
                  {...form.register("patient.medicalHistory")}
                />
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={
                    form.formState.errors.patient?.emergencyContactName?.message
                  }
                  label="Emergency contact name"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.emergencyContactName")}
                  />
                </FormField>
                <FormField
                  error={
                    form.formState.errors.patient?.emergencyContactPhone
                      ?.message
                  }
                  label="Emergency contact phone"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.emergencyContactPhone")}
                  />
                </FormField>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                  Optional vitals
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <FormField
                    error={form.formState.errors.patient?.temperature?.message}
                    label="Temperature"
                  >
                    <Input
                      placeholder="36.8"
                      {...form.register("patient.temperature")}
                    />
                  </FormField>
                  <FormField
                    error={
                      form.formState.errors.patient?.bloodPressure?.message
                    }
                    label="Blood pressure"
                  >
                    <Input
                      placeholder="120/80"
                      {...form.register("patient.bloodPressure")}
                    />
                  </FormField>
                  <FormField
                    error={form.formState.errors.patient?.heartRate?.message}
                    label="Heart rate"
                  >
                    <Input
                      placeholder="76"
                      {...form.register("patient.heartRate")}
                    />
                  </FormField>
                  <FormField
                    error={form.formState.errors.patient?.o2Sat?.message}
                    label="O2 saturation"
                  >
                    <Input
                      placeholder="99"
                      {...form.register("patient.o2Sat")}
                    />
                  </FormField>
                  <FormField
                    error={
                      form.formState.errors.patient?.respiratoryRate?.message
                    }
                    label="Respiratory rate"
                  >
                    <Input
                      placeholder="16"
                      {...form.register("patient.respiratoryRate")}
                    />
                  </FormField>
                  <FormField
                    error={form.formState.errors.patient?.weight?.message}
                    label="Weight"
                  >
                    <Input
                      placeholder="55"
                      {...form.register("patient.weight")}
                    />
                  </FormField>
                  <FormField
                    error={form.formState.errors.patient?.height?.message}
                    label="Height"
                  >
                    <Input
                      placeholder="160"
                      {...form.register("patient.height")}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          ) : null}

          {stage === "appointment" ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Patient and Provider
                </p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  {createdPatient
                    ? `${createdPatient.firstName} ${createdPatient.lastName}`
                    : "Patient selected"}
                </p>
              </div>

              <FormField
                error={form.formState.errors.appointment?.doctorId?.message}
                label="Doctor"
              >
                <Select {...form.register("appointment.doctorId")}>
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                error={form.formState.errors.appointment?.serviceId?.message}
                label="Service"
              >
                <Select {...form.register("appointment.serviceId")}>
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={form.formState.errors.appointment?.status?.message}
                  label="Status"
                >
                  <Select {...form.register("appointment.status")}>
                    <option value="confirmed">Confirmed</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </Select>
                </FormField>
                <FormField
                  error={form.formState.errors.appointment?.source?.message}
                  label="Source"
                >
                  <Select {...form.register("appointment.source")}>
                    <option value="internal">Internal</option>
                    <option value="portal">Portal</option>
                  </Select>
                </FormField>
              </div>

              <FormField
                error={form.formState.errors.appointment?.visitType?.message}
                label="Visit type"
              >
                <Select {...form.register("appointment.visitType")}>
                  <option value="in_person">In person</option>
                  <option value="teleconsultation">Teleconsultation</option>
                </Select>
              </FormField>

              <div className="rounded-sm border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                Appointment schedule is now queue-based. When you create this
                appointment, the system will auto-assign queue number, scheduled
                time, and estimated end time.
              </div>

              <FormField
                error={form.formState.errors.appointment?.reason?.message}
                label="Reason"
              >
                <Input {...form.register("appointment.reason")} />
              </FormField>

              <FormField
                error={form.formState.errors.appointment?.notes?.message}
                label="Notes"
              >
                <Textarea {...form.register("appointment.notes")} />
              </FormField>
            </div>
          ) : null}

          {stage === "billing" ? (
            <div className="space-y-5">
              <div className="border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
                  Invoice Form
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  Create the actual invoice before sending the patient to
                  consultation.
                </p>
              </div>

              <FormField
                error={form.formState.errors.billing?.patientId?.message}
                label="Select patient"
              >
                <div className="relative">
                  <Input
                    onBlur={() => {
                      window.setTimeout(
                        () => setIsInvoicePatientDropdownOpen(false),
                        120,
                      );
                    }}
                    onFocus={() => setIsInvoicePatientDropdownOpen(true)}
                    onChange={(event) => {
                      const query = event.target.value;
                      setInvoicePatientSearch(query);
                      setIsInvoicePatientDropdownOpen(true);

                      const exactMatch = patients.find(
                        (patient) =>
                          `${patient.firstName} ${patient.lastName}`
                            .trim()
                            .toLowerCase() === query.trim().toLowerCase(),
                      );

                      if (exactMatch) {
                        form.setValue("billing.patientId", exactMatch.id, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        return;
                      }

                      form.setValue("billing.patientId", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    placeholder="Type patient name"
                    value={invoicePatientSearch}
                  />
                  {isInvoicePatientDropdownOpen ? (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg">
                      {filteredInvoicePatients.length > 0 ? (
                        filteredInvoicePatients.slice(0, 20).map((patient) => (
                          <button
                            className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                              selectedBillingPatientId === patient.id
                                ? "bg-emerald-50 text-emerald-800"
                                : "text-slate-700"
                            }`}
                            key={patient.id}
                            onMouseDown={() => {
                              form.setValue("billing.patientId", patient.id, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setInvoicePatientSearch(
                                `${patient.firstName} ${patient.lastName}`,
                              );
                              setIsInvoicePatientDropdownOpen(false);
                            }}
                            type="button"
                          >
                            {patient.firstName} {patient.lastName}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          No matching patients found.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </FormField>

              <FormField label="Tag from booking">
                <Select
                  {...form.register("billing.bookingId")}
                  onChange={(event) => {
                    const booking =
                      bookings.find((item) => item.id === event.target.value) ??
                      null;
                    form.setValue("billing.bookingId", event.target.value);
                    if (!booking) {
                      form.setValue("billing.items", [
                        {
                          description:
                            selectedService?.name ?? "General Consultation",
                          category: "consultation",
                          quantity: 1,
                          unitPrice: selectedService?.price ?? 800,
                        },
                      ]);
                      return;
                    }

                    form.setValue("billing.patientId", booking.patientId, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    const bookingPatient =
                      patients.find(
                        (patient) => patient.id === booking.patientId,
                      ) ?? null;
                    if (bookingPatient) {
                      setInvoicePatientSearch(
                        `${bookingPatient.firstName} ${bookingPatient.lastName}`,
                      );
                    }
                    form.setValue("billing.items", [
                      {
                        description:
                          booking.feeType === "follow_up"
                            ? "Follow-up Consultation"
                            : "Consultation Fee",
                        category: "consultation",
                        quantity: 1,
                        unitPrice: booking.feeAmount,
                      },
                    ]);
                  }}
                >
                  <option value="">Manual entry</option>
                  {bookings.map((booking) => {
                    const patient = patients.find(
                      (item) => item.id === booking.patientId,
                    );
                    return (
                      <option key={booking.id} value={booking.id}>
                        {patient?.firstName} {patient?.lastName} -{" "}
                        {booking.feeType === "follow_up"
                          ? "Follow-up"
                          : "Consultation"}
                      </option>
                    );
                  })}
                </Select>
              </FormField>

              <FormField label="Link to appointment (optional but recommended)">
                <Select
                  {...form.register("billing.appointmentId")}
                  onChange={(event) => {
                    form.setValue("billing.appointmentId", event.target.value);
                  }}
                >
                  <option value="">Select an appointment</option>
                  {(createdAppointment ? [createdAppointment] : appointments)
                    .filter(
                      (appointment) =>
                        appointment.patientId ===
                        form.watch("billing.patientId"),
                    )
                    .filter(
                      (appointment) =>
                        !["cancelled", "completed", "no_show"].includes(
                          appointment.status,
                        ),
                    )
                    .sort(
                      (left, right) =>
                        new Date(right.scheduledAt).getTime() -
                        new Date(left.scheduledAt).getTime(),
                    )
                    .map((appointment) => {
                      const scheduled = new Date(appointment.scheduledAt);
                      const formatted = scheduled.toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <option key={appointment.id} value={appointment.id}>
                          {formatted} - {appointment.status}
                        </option>
                      );
                    })}
                </Select>
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Payment status">
                  <Select {...form.register("billing.paymentStatus")}>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </Select>
                </FormField>

                {selectedBillingPaymentStatus === "paid" ? (
                  <FormField
                    error={
                      form.formState.errors.billing?.referenceNumber?.message
                    }
                    label="Reference number"
                  >
                    <Input
                      placeholder="Enter reference number"
                      {...form.register("billing.referenceNumber")}
                    />
                  </FormField>
                ) : null}
              </div>

              {selectedBillingPaymentStatus === "paid" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Payment type">
                    <Select {...form.register("billing.paymentType")}>
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="card">Card</option>
                    </Select>
                  </FormField>
                </div>
              ) : null}

              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      Line items
                    </p>
                    <p className="text-sm text-slate-500">
                      Add the invoice items that will be printed on the receipt.
                    </p>
                  </div>
                  <Button
                    className="rounded-none border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:bg-slate-100"
                    onClick={() =>
                      billingItems.append({
                        description: "New service",
                        category: "other",
                        quantity: 1,
                        unitPrice: 0,
                      })
                    }
                    type="button"
                    variant="secondary"
                  >
                    Add line item
                  </Button>
                </div>

                {billingItems.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Item {index + 1}
                      </p>
                      {billingItems.fields.length > 1 ? (
                        <button
                          className="text-xs font-semibold uppercase tracking-widest text-rose-600 hover:text-rose-700"
                          onClick={() => billingItems.remove(index)}
                          type="button"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <FormField
                        error={
                          form.formState.errors.billing?.items?.[index]
                            ?.description?.message
                        }
                        label="Description"
                      >
                        <Input
                          {...form.register(
                            `billing.items.${index}.description` as const,
                          )}
                        />
                      </FormField>
                      <FormField
                        error={
                          form.formState.errors.billing?.items?.[index]
                            ?.category?.message
                        }
                        label="Category"
                      >
                        <Select
                          {...form.register(
                            `billing.items.${index}.category` as const,
                          )}
                        >
                          <option value="consultation">Consultation</option>
                          <option value="laboratory">Laboratory</option>
                          <option value="medicine">Medicine</option>
                          <option value="other">Other</option>
                        </Select>
                      </FormField>
                      <FormField
                        error={
                          form.formState.errors.billing?.items?.[index]
                            ?.quantity?.message
                        }
                        label="Qty"
                      >
                        <Input
                          type="number"
                          {...form.register(
                            `billing.items.${index}.quantity` as const,
                            { valueAsNumber: true },
                          )}
                        />
                      </FormField>
                      <FormField
                        error={
                          form.formState.errors.billing?.items?.[index]
                            ?.unitPrice?.message
                        }
                        label="Unit price"
                      >
                        <Input
                          type="number"
                          {...form.register(
                            `billing.items.${index}.unitPrice` as const,
                            { valueAsNumber: true },
                          )}
                        />
                      </FormField>
                    </div>
                  </div>
                ))}
                <p className="text-sm font-semibold text-slate-700">
                  Total:{" "}
                  {formatCurrency(
                    (billingLineItems ?? []).reduce(
                      (sum, item) =>
                        sum +
                        (Number(item.quantity) || 0) *
                          (Number(item.unitPrice) || 0),
                      0,
                    ),
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                Billing completion will mark the appointment as in progress and
                send the patient to consultation.
              </div>
            </div>
          ) : null}

          {stage === "complete" ? (
            <div className="space-y-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-700">
                Workflow complete
              </p>
              <h3 className="text-2xl font-black tracking-tight text-slate-950">
                Patient is ready for consultation
              </h3>
              <p className="max-w-2xl text-sm text-emerald-900/80">
                The patient record, appointment, and billing record were created
                in one flow, and the appointment has been marked in progress.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-none bg-emerald-700 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-emerald-800"
                  onClick={onClose}
                  type="button"
                >
                  Finish
                </Button>
                {createdPatient ? (
                  <Link
                    className="inline-flex items-center border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                    to={`/app/patients/${createdPatient.id}`}
                  >
                    Open patient chart
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {stage !== "complete" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <div className="text-xs text-slate-500">
              Step {stepIndex + 1} of 4
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-none border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-widest"
                disabled={isBusy || stage === "patient"}
                onClick={() =>
                  setStage(
                    stage === "billing"
                      ? "appointment"
                      : stage === "appointment"
                        ? "patient"
                        : stage,
                  )
                }
                type="button"
                variant="secondary"
              >
                Back
              </Button>
              <Button
                className="rounded-none bg-orange-600 px-4 py-2 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700"
                disabled={isBusy}
                onClick={() => {
                  if (stage === "patient") {
                    void handlePatientStep();
                  } else if (stage === "appointment") {
                    void handleAppointmentStep();
                  } else if (stage === "billing") {
                    void handleBillingStep();
                  }
                }}
                type="button"
              >
                {isBusy
                  ? "Saving..."
                  : stage === "patient"
                    ? isUsingExistingPatient
                      ? "Next"
                      : "Save patient"
                    : stage === "appointment"
                      ? "Create appointment"
                      : "Bill and send to doctor"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
