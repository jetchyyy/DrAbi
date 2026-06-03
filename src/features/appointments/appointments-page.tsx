import { zodResolver } from "@hookform/resolvers/zod";
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { StatusPill } from "../../components/ui/status-pill";

import { cn } from "../../lib/utils";
import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { FeedbackModal } from "../../components/ui/feedback-modal";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
  INTERNAL_BTN_PAGE,
  INTERNAL_BTN_PAGE_ACTIVE,
  INTERNAL_SEARCH_INPUT_WRAP,
  INTERNAL_SURFACE,
  INTERNAL_SURFACE_FOOTER,
  INTERNAL_TABLE,
  INTERNAL_TD,
  INTERNAL_TH,
  INTERNAL_THEAD_ROW,
  INTERNAL_TR,
} from "../../lib/internal-ui";
import {
  useClinicSettingsData,
  useDoctorDirectory,
  useDoctorAvailability,
  useServicesCatalog,
  useSpecialtiesCatalog,
} from "../../hooks/use-clinic-data";
import {
  buildDailyTimeSlots,
  getAvailableTimeSlotsForDate,
  timeToMinutes,
} from "../../lib/doctor-availability";
import {
  formatDateTimeLabel,
  getPhilippineDateKey,
  getPhilippineTimeKey,
  toPhilippineDateTimeLocalValue,
  toUtcIsoFromPhilippineDateTime,
} from "../../lib/utils";
import { openQueuePrint } from "./components/appointments-que";
import type { Appointment } from "../../types/domain";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { usePatients } from "../patients/hooks/use-patients";
import { isTeleconsultJoinableStatus } from "../teleconsult/teleconsult-data";
import {
  useAppointments,
  useCreateAppointment,
  useDeleteAppointment,
  useUpdateAppointment,
} from "./hooks/use-appointments";
import { useCompanies } from "../companies/api/companies-hooks";

const appointmentSchema = z
  .object({
    patientId: z.string().optional(),
    doctorId: z.string().min(1, "Doctor is required."),
    specialtyId: z.string().optional(),
    serviceId: z.string().min(1, "Service is required."),
    companyId: z.string().optional(),
    scheduledAt: z.string().min(1, "Scheduled time is required."),
    status: z.enum([
      "scheduled",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
      "no_show",
    ]),
    source: z.enum(["internal", "portal"]),
    visitType: z.enum(["in_person", "teleconsultation"]),
    reason: z.string().min(4, "Reason for visit must be at least 4 characters."),
    notes: z.string().min(2, "Notes must be at least 2 characters."),
    teleconsultationPlatform: z.string().optional(),
    teleconsultationUrl: z.string().optional(),
    teleconsultationAccessInstructions: z.string().optional(),
    isDoctorsOnly: z.boolean(),
    additionalDoctorIds: z.array(z.string()),
  })
  .refine((data) => data.isDoctorsOnly || (data.patientId && data.patientId.length > 0), {
    message: "Patient is required.",
    path: ["patientId"],
  });

const APPOINTMENTS_PAGE_SIZE = 10;

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: "success" | "error";
}

function getDefaultScheduledAtValue() {
  return `${getPhilippineDateKey()}T${getPhilippineTimeKey().slice(0, 5)}`;
}

export function AppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: appointments = [] } = useAppointments();
  const { data: patients = [] } = usePatients();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: services = [] } = useServicesCatalog();
  const { data: specialties = [] } = useSpecialtiesCatalog();
  const { data: companies = [] } = useCompanies();
  const createAppointmentMutation = useCreateAppointment();
  const updateAppointmentMutation = useUpdateAppointment();
  const deleteAppointmentMutation = useDeleteAppointment();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState("");
  const doctorSearchInputRef = useRef<HTMLInputElement>(null);

  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: "",
    message: "",
    variant: "success",
  });
  const deferredSearch = useDeferredValue(search);
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: "",
      doctorId: "",
      specialtyId: "",
      serviceId: "",
      companyId: "",
      scheduledAt: "2026-03-26T09:00",
      status: "scheduled",
      source: "internal",
      visitType: "in_person",
      reason: "",
      notes: "",
      teleconsultationPlatform: "Jitsi Meet",
      teleconsultationUrl: "",
      teleconsultationAccessInstructions: "",
      isDoctorsOnly: false,
      additionalDoctorIds: [],
    },
  });

  const visitType = useWatch({ control: form.control, name: "visitType" });
  const isDoctorsOnly = useWatch({ control: form.control, name: "isDoctorsOnly" });
  const additionalDoctorIds = useWatch({ control: form.control, name: "additionalDoctorIds" }) || [];
  const scheduledAtValue = useWatch({
    control: form.control,
    name: "scheduledAt",
  });
  const selectedDoctorId = useWatch({
    control: form.control,
    name: "doctorId",
  });
  const selectedServiceId = useWatch({
    control: form.control,
    name: "serviceId",
  });
  const selectedScheduleDate = scheduledAtValue?.slice(0, 10) ?? "";
  const selectedScheduleTime = scheduledAtValue?.slice(11, 16) ?? "";
  const todayDateKey = getPhilippineDateKey();
  const currentTimeKey = getPhilippineTimeKey();
  const currentTimeMinutes = timeToMinutes(currentTimeKey);
  const originalScheduledAt = editingAppointment
    ? toPhilippineDateTimeLocalValue(editingAppointment.scheduledAt)
    : null;
  const isEditingCurrentScheduledAt =
    Boolean(originalScheduledAt) && scheduledAtValue === originalScheduledAt;

  const { data: doctorAvailability = [] } = useDoctorAvailability(
    selectedDoctorId || null,
  );
  // Note: removed blocked slot checks — queueing will handle conflicts
  const allTimeSlots = useMemo(() => {
    if (!selectedScheduleDate || !selectedDoctorId) {
      return [];
    }

    if (doctorAvailability.length > 0) {
      return getAvailableTimeSlotsForDate(
        doctorAvailability,
        selectedScheduleDate,
      );
    }

    return buildDailyTimeSlots(clinicSettings?.appointmentSlotMinutes || 30);
  }, [
    clinicSettings?.appointmentSlotMinutes,
    doctorAvailability,
    selectedDoctorId,
    selectedScheduleDate,
  ]);
  const availableTimeSlots = useMemo(() => {
    if (!selectedScheduleDate) {
      return [];
    }

    const slots = allTimeSlots;

    if (selectedScheduleDate !== todayDateKey) {
      return slots;
    }

    return slots.filter((time) => {
      if (isEditingCurrentScheduledAt && time === selectedScheduleTime) {
        return true;
      }

      return timeToMinutes(time) > currentTimeMinutes;
    });
  }, [
    allTimeSlots,
    currentTimeMinutes,
    isEditingCurrentScheduledAt,
    selectedScheduleDate,
    selectedScheduleTime,
    todayDateKey,
  ]);

  const patientMap = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  );
  const doctorMap = useMemo(
    () => new Map(doctors.map((doctor) => [doctor.id, doctor])),
    [doctors],
  );
  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );
  const specialtyMap = useMemo(
    () => new Map(specialties.map((specialty) => [specialty.id, specialty])),
    [specialties],
  );

  const defaultSpecialtyId = useMemo(() => {
    return doctors[0]?.specialtyId ?? specialties[0]?.id ?? "";
  }, [doctors, specialties]);

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const patient = appointment.patientId ? patientMap.get(appointment.patientId) : null;
        const patientName = patient
          ? `${patient.firstName} ${patient.lastName}`
          : "Doctors Collaboration Meeting";
        const doctor = doctorMap.get(appointment.doctorId);
        const service = serviceMap.get(appointment.serviceId);
        const specialty = specialtyMap.get(appointment.specialtyId);

        const additionalDocsStr = (appointment.additionalDoctorIds || [])
          .map((id) => doctorMap.get(id)?.fullName ?? "")
          .join(" ");

        return `${patientName} ${doctor?.fullName ?? ""} ${additionalDocsStr} ${service?.name ?? ""} ${specialty?.name ?? ""} ${appointment.status} ${appointment.visitType} ${appointment.reason}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase());
      }),
    [
      appointments,
      deferredSearch,
      doctorMap,
      patientMap,
      serviceMap,
      specialtyMap,
    ],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAppointments.length / APPOINTMENTS_PAGE_SIZE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * APPOINTMENTS_PAGE_SIZE;
  const paginatedAppointments = useMemo(
    () =>
      filteredAppointments.slice(pageStart, pageStart + APPOINTMENTS_PAGE_SIZE),
    [filteredAppointments, pageStart],
  );
  const showingStart = filteredAppointments.length === 0 ? 0 : pageStart + 1;
  const showingEnd =
    filteredAppointments.length === 0
      ? 0
      : Math.min(
          pageStart + APPOINTMENTS_PAGE_SIZE,
          filteredAppointments.length,
        );

  useEffect(() => {
    const selectedDoctor = doctors.find(
      (doctor) => doctor.id === selectedDoctorId,
    );
    const selectedService = services.find(
      (service) => service.id === selectedServiceId,
    );
    const nextSpecialtyId =
      selectedService?.specialtyId ?? selectedDoctor?.specialtyId ?? "";
    const currentSpecialtyId = form.getValues("specialtyId") ?? "";

    if (!nextSpecialtyId || currentSpecialtyId === nextSpecialtyId) {
      return;
    }

    form.setValue("specialtyId", nextSpecialtyId, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [doctors, form, selectedDoctorId, selectedServiceId, services]);

  useEffect(() => {
    if (!selectedScheduleDate) {
      return;
    }

    if (availableTimeSlots.length === 0) {
      // Schedule controls are hidden in this modal; keep the existing required
      // value so submit is not silently blocked when no same-day slots remain.
      return;
    }

    if (availableTimeSlots.includes(selectedScheduleTime)) {
      return;
    }

    form.setValue(
      "scheduledAt",
      `${selectedScheduleDate}T${availableTimeSlots[0]}`,
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
  }, [
    availableTimeSlots,
    form,
    isEditingCurrentScheduledAt,
    scheduledAtValue,
    selectedScheduleDate,
    selectedScheduleTime,
  ]);

  useEffect(() => {
    if (!isAppointmentModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAppointmentModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAppointmentModalOpen]);

  const openCreateModal = ({
    patientId,
    source,
  }: {
    patientId?: string;
    source?: Appointment["source"];
  } = {}) => {
    const defaultScheduledAt = getDefaultScheduledAtValue();
    const selectedPatientId =
      patientId && patients.some((patient) => patient.id === patientId)
        ? patientId
        : (patients[0]?.id ?? "");
    const selectedPatient = patients.find((p) => p.id === selectedPatientId);
    form.reset({
      patientId: selectedPatientId,
      doctorId: doctors[0]?.id ?? "",
      specialtyId: defaultSpecialtyId,
      serviceId: services[0]?.id ?? "",
      companyId: selectedPatient?.companyId ?? "",
      scheduledAt: defaultScheduledAt,
      status: "scheduled",
      source: source ?? "internal",
      visitType: "in_person",
      reason: "",
      notes: "",
      teleconsultationPlatform: "Jitsi Meet",
      teleconsultationUrl: "",
      teleconsultationAccessInstructions: "",
      isDoctorsOnly: false,
      additionalDoctorIds: [],
    });
    setEditingAppointment(null);
    setIsAppointmentModalOpen(true);
  };

  useEffect(() => {
    const action = (searchParams.get("action") ?? "").trim();
    if (action !== "create") {
      return;
    }

    const patientIdFromQuery = (searchParams.get("patientId") ?? "").trim();
    const sourceFromQuery = (searchParams.get("source") ?? "").trim();
    const normalizedSource: Appointment["source"] =
      sourceFromQuery === "portal" ? "portal" : "internal";

    openCreateModal({
      patientId: patientIdFromQuery || undefined,
      source: normalizedSource,
    });

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("action");
    nextParams.delete("patientId");
    nextParams.delete("source");
    setSearchParams(nextParams, { replace: true });
  }, [patients, doctors, services, searchParams, setSearchParams]);

  const openEditModal = (appointment: Appointment) => {
    const scheduledAt = toPhilippineDateTimeLocalValue(appointment.scheduledAt);
    form.reset({
      patientId: appointment.patientId || "",
      doctorId: appointment.doctorId,
      specialtyId: appointment.specialtyId,
      serviceId: appointment.serviceId,
      companyId: appointment.companyId || "",
      scheduledAt,
      status: appointment.status,
      source: appointment.source,
      visitType: appointment.visitType,
      reason: appointment.reason,
      notes: appointment.notes,
      teleconsultationPlatform:
        appointment.teleconsultationPlatform ?? "Jitsi Meet",
      teleconsultationUrl: appointment.teleconsultationUrl ?? "",
      teleconsultationAccessInstructions:
        appointment.teleconsultationAccessInstructions ?? "",
      isDoctorsOnly: !appointment.patientId,
      additionalDoctorIds: appointment.additionalDoctorIds || [],
    });
    setEditingAppointment(appointment);
    setIsAppointmentModalOpen(true);
  };

  const closeAppointmentModal = () => {
    setEditingAppointment(null);
    setIsAppointmentModalOpen(false);
    setIsAddDoctorOpen(false);
    setDoctorSearchQuery("");
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const scheduledAtUtc = editingAppointment
      ? toUtcIsoFromPhilippineDateTime(values.scheduledAt)
      : new Date().toISOString();

    const basePayload = {
      patientId: values.isDoctorsOnly ? null : (values.patientId || null),
      doctorId: values.doctorId,
      specialtyId: values.specialtyId ?? "",
      serviceId: values.serviceId,
      companyId: values.companyId || null,
      scheduledAt: scheduledAtUtc,
      status: values.status,
      source: values.source,
      visitType: values.visitType,
      reason: values.reason,
      notes: values.notes,
      teleconsultationPlatform:
        values.visitType === "teleconsultation"
          ? values.teleconsultationPlatform || "Jitsi Meet"
          : undefined,
      teleconsultationUrl:
        values.visitType === "teleconsultation"
          ? values.teleconsultationUrl || undefined
          : undefined,
      teleconsultationAccessInstructions:
        values.visitType === "teleconsultation"
          ? values.teleconsultationAccessInstructions || undefined
          : undefined,
      additionalDoctorIds: values.additionalDoctorIds || [],
    };

    try {
      if (editingAppointment) {
        await updateAppointmentMutation.mutateAsync({
          appointmentId: editingAppointment.id,
          payload: basePayload,
        });
        setFeedbackModal({
          open: true,
          title: "Appointment updated",
          message: "The appointment details were updated successfully.",
          variant: "success",
        });
      } else {
        const isTeleconsult = values.visitType === "teleconsultation";

        // --- Receipt code generation ---
        const selectedCompany = values.companyId
          ? companies.find((c) => c.id === values.companyId)
          : null;
        const companyCodePart = selectedCompany?.companyCode?.trim().toUpperCase() || "GEN";
        const now = new Date();
        const yearPart = now.getFullYear();
        const monthPart = String(now.getMonth() + 1).padStart(2, "0");

        let receiptSeq = 1;
        try {
          if (isSupabaseConfigured && supabase) {
            const { data: rcData } = await supabase
              .from("appointments")
              .select("receipt_code")
              .like("receipt_code", `${companyCodePart}-%`);
            const rcRows = (rcData ?? []) as Array<{ receipt_code: string | null }>;
            if (rcRows.length > 0) {
              const highest = rcRows.reduce((max, row) => {
                const m = String(row.receipt_code ?? "").match(/(\d+)$/);
                const val = m ? Number(m[1]) : 0;
                return Math.max(max, Number.isFinite(val) ? val : 0);
              }, 0);
              receiptSeq = highest + 1;
            }
          } else {
            const lsKey = `appt_receipt_seq_${companyCodePart}`;
            const stored = Number(localStorage.getItem(lsKey) || "0");
            receiptSeq = stored + 1;
            localStorage.setItem(lsKey, String(receiptSeq));
          }
        } catch {
          const lsKey = `appt_receipt_seq_${companyCodePart}`;
          const stored = Number(localStorage.getItem(lsKey) || "0");
          receiptSeq = stored + 1;
          localStorage.setItem(lsKey, String(receiptSeq));
        }
        const receiptCode = `${companyCodePart}-${yearPart}-${monthPart}-${String(receiptSeq).padStart(6, "0")}`;

        // --- Queue number generation (only for in-person) ---
        let queueNumber = "ODC-QUE-000001";
        if (!isTeleconsult) {
          try {
            if (isSupabaseConfigured && supabase) {
              const { data, error } = await supabase
                .from("appointments")
                .select("queue_number")
                .not("queue_number", "is", null);
              const latest = (data ?? []) as Array<{
                queue_number: string | null;
              }>;
              if (!error && latest && latest.length > 0) {
                const highestQueue = latest.reduce((max, row) => {
                  const m = String(row.queue_number ?? "").match(/(\d+)$/);
                  const value = m ? Number(m[1]) : 0;
                  return Math.max(max, Number.isFinite(value) ? value : 0);
                }, 0);
                const next = highestQueue + 1;
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
        }

        const scheduledDate = new Date(scheduledAtUtc);
        const minutes = scheduledDate.getMinutes();
        let estimatedEndDate = new Date(scheduledDate);

        // if less than 15 mins -> set to :30
        if (minutes < 15) {
          estimatedEndDate.setMinutes(30, 0, 0);
        }
        // if greater than or equal to 30 -> next hour :00
        else if (minutes >= 30) {
          estimatedEndDate.setHours(estimatedEndDate.getHours() + 1);
          estimatedEndDate.setMinutes(0, 0, 0);
        }
        // between 15 and 29 -> also :30
        else {
          estimatedEndDate.setMinutes(30, 0, 0);
        }

        const estimatedEnd = estimatedEndDate.toISOString();

        const created = await createAppointmentMutation.mutateAsync({
          ...basePayload,
          queue_number: isTeleconsult ? null : queueNumber,
          estimated_end: estimatedEnd,
          receipt_code: receiptCode,
        } as never);

        setFeedbackModal({
          open: true,
          title: "Appointment created",
          message: "The new appointment has been added to the schedule.",
          variant: "success",
        });

        const patient = values.patientId ? patientMap.get(values.patientId) : null;
        const patientName = patient
          ? `${patient.firstName} ${patient.lastName}`
          : (values.isDoctorsOnly ? "Doctors Collaboration Meeting" : "Patient");

        if (!values.isDoctorsOnly && !isTeleconsult) {
          openQueuePrint({
            queueNumber,
            scheduledAt: created?.scheduledAt ?? scheduledAtUtc,
            estimatedEnd,
            patientName,
          });
        }
      }

      closeAppointmentModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingAppointment
          ? "Unable to update appointment"
          : "Unable to create appointment",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while saving the appointment.",
        variant: "error",
      });
    }
  });

  const handleDeleteAppointment = async (appointment: Appointment) => {
    const patient = appointment.patientId ? patientMap.get(appointment.patientId) : null;
    const patientName = patient
      ? `${patient.firstName} ${patient.lastName}`
      : "this patient";
    const isConfirmed = window.confirm(
      `Delete the appointment for ${patientName}?`,
    );
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteAppointmentMutation.mutateAsync(appointment.id);
      setFeedbackModal({
        open: true,
        title: "Appointment deleted",
        message: "The appointment was removed successfully.",
        variant: "success",
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: "Unable to delete appointment",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while deleting the appointment.",
        variant: "error",
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
          <div className="flex flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Operations</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Appointments and Queue</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Schedule, track, and manage patient appointments including teleconsultation visits.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                className="gap-2"
                onClick={() => openCreateModal()}
              >
                <Plus className="size-4" />
                New appointment
              </Button>
              <div className={INTERNAL_SEARCH_INPUT_WRAP}>
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search patient, doctor, service, or status"
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
              {filteredAppointments.length} appointment
              {filteredAppointments.length !== 1 ? "s" : ""}
            </span>
          </div>
        </section>

        <div className={INTERNAL_SURFACE}>
          <div className="overflow-x-auto">
            <table className={INTERNAL_TABLE}>
              <thead>
                <tr className={INTERNAL_THEAD_ROW}>
                  <th className={INTERNAL_TH}>Patient</th>
                  <th className={INTERNAL_TH}>Doctor / Service</th>
                  <th className={INTERNAL_TH}>Schedule</th>
                  <th className={INTERNAL_TH}>Visit Type</th>
                  <th className={INTERNAL_TH}>Status</th>
                  <th className={cn(INTERNAL_TH, "text-right")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAppointments.map((appointment) => {
                  const patient = appointment.patientId ? patientMap.get(appointment.patientId) : null;
                  const doctor = doctorMap.get(appointment.doctorId);
                  const service = serviceMap.get(appointment.serviceId);

                  return (
                    <tr className={INTERNAL_TR} key={appointment.id}>
                      <td className={INTERNAL_TD}>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900">
                            {patient
                              ? `${patient.firstName} ${patient.lastName}`
                              : "Doctors Collaboration Meeting"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {appointment.reason}
                          </p>
                        </div>
                      </td>
                      <td className={INTERNAL_TD}>
                        <div className="space-y-0.5 text-sm">
                          <p className="text-slate-700">
                            {doctor?.fullName}
                            {appointment.additionalDoctorIds && appointment.additionalDoctorIds.length > 0 && (
                              <span className="ml-1.5 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80">
                                +{appointment.additionalDoctorIds.length} doctor{appointment.additionalDoctorIds.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {service?.name}
                          </p>
                        </div>
                      </td>
                      <td
                        className={cn(INTERNAL_TD, "whitespace-nowrap text-sm")}
                      >
                        {formatDateTimeLabel(appointment.scheduledAt)}
                      </td>
                      <td className={INTERNAL_TD}>
                        {appointment.visitType === "teleconsultation" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
                            <Video className="size-3" />
                            Teleconsultation
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
                            In Person
                          </span>
                        )}
                      </td>
                      <td className={INTERNAL_TD}>
                        <StatusPill status={appointment.status} />
                      </td>
                      <td className={cn(INTERNAL_TD, "text-right")}>
                        <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-semibold">
                          <button
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-[var(--color-primary)] hover:underline"
                            onClick={() => openEditModal(appointment)}
                            type="button"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button
                            className="inline-flex items-center gap-1 text-rose-600 hover:underline"
                            onClick={() =>
                              void handleDeleteAppointment(appointment)
                            }
                            type="button"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                          {appointment.visitType === "teleconsultation" &&
                          isTeleconsultJoinableStatus(appointment.status) ? (
                            <Link
                              className="inline-flex items-center text-[var(--color-primary)] hover:underline"
                              to={`/app/teleconsult/${appointment.id}`}
                            >
                              Join Teleconsult
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td
                      className="px-6 py-10 text-center text-sm text-slate-400"
                      colSpan={6}
                    >
                      No appointments found for this search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {filteredAppointments.length > 0 ? (
            <div
              className={cn(
                INTERNAL_SURFACE_FOOTER,
                "flex flex-wrap items-center justify-between gap-3 px-6 py-3",
              )}
            >
              <p className="text-xs text-slate-500">
                Showing {showingStart}–{showingEnd} of{" "}
                {filteredAppointments.length} appointments
              </p>
              <div className="flex items-center gap-1.5">
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={cn(
                        INTERNAL_BTN_PAGE,
                        page === safeCurrentPage && INTERNAL_BTN_PAGE_ACTIVE,
                      )}
                      onClick={() => setCurrentPage(page)}
                      type="button"
                    >
                      {page}
                    </button>
                  ),
                )}
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
      </div>

      {isAppointmentModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeAppointmentModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Appointments
                </p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {editingAppointment ? "Edit Appointment" : "Schedule Appointment"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Set patient, provider, schedule, and teleconsult details.
                </p>
              </div>
              <button
                aria-label="Close appointment modal"
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                onClick={closeAppointmentModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-4 py-5 sm:px-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Patient and Provider
                  </p>
                  {/* Doctors-Only Meeting toggle */}
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      id="isDoctorsOnly"
                      type="checkbox"
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 size-4"
                      {...form.register("isDoctorsOnly")}
                    />
                    <label htmlFor="isDoctorsOnly" className="text-sm font-medium text-slate-700">
                      Doctors-Only Meeting (Collaboration)
                    </label>
                  </div>

                  {!isDoctorsOnly && (
                    <FormField
                      error={form.formState.errors.patientId?.message}
                      label="Patient"
                    >
                      <Select
                        {...form.register("patientId")}
                        onChange={(e) => {
                          void form.register("patientId").onChange(e);
                          const patientId = e.target.value;
                          const patient = patients.find((p) => p.id === patientId);
                          if (patient?.companyId) {
                            form.setValue("companyId", patient.companyId, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          } else {
                            form.setValue("companyId", "", {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                      >
                        <option value="">Select patient</option>
                        {patients.map((patient) => (
                          <option key={patient.id} value={patient.id}>
                            {patient.firstName} {patient.lastName}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      error={form.formState.errors.doctorId?.message}
                      label="Primary Doctor"
                    >
                      <Select {...form.register("doctorId")}>
                        <option value="">Select doctor</option>
                        {doctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.fullName}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField
                      error={form.formState.errors.specialtyId?.message}
                      label="Specialty"
                    >
                      <Select {...form.register("specialtyId")}>
                        <option value="">Unassigned</option>
                        {specialties.map((specialty) => (
                          <option key={specialty.id} value={specialty.id}>
                            {specialty.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  {/* Additional Doctors */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">
                        Additional Doctors
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => {
                            setIsAddDoctorOpen(!isAddDoctorOpen);
                            setDoctorSearchQuery("");
                            setTimeout(() => doctorSearchInputRef.current?.focus(), 50);
                          }}
                        >
                          <Plus className="size-3.5" />
                          Add Doctor
                        </button>

                        {isAddDoctorOpen && (
                          <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
                            <div className="border-b border-slate-100 p-2">
                              <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                  ref={doctorSearchInputRef}
                                  type="text"
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                  placeholder="Search doctors..."
                                  value={doctorSearchQuery}
                                  onChange={(e) => setDoctorSearchQuery(e.target.value)}
                                />
                              </div>
                            </div>
                            <ul className="max-h-44 overflow-y-auto p-1.5">
                              {doctors
                                .filter(
                                  (doctor) =>
                                    doctor.id !== selectedDoctorId &&
                                    !additionalDoctorIds.includes(doctor.id) &&
                                    doctor.fullName
                                      .toLowerCase()
                                      .includes(doctorSearchQuery.toLowerCase()),
                                )
                                .map((doctor) => (
                                  <li key={doctor.id}>
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
                                      onClick={() => {
                                        const currentIds = form.getValues("additionalDoctorIds") || [];
                                        form.setValue("additionalDoctorIds", [...currentIds, doctor.id]);
                                        setIsAddDoctorOpen(false);
                                        setDoctorSearchQuery("");
                                      }}
                                    >
                                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                                        {doctor.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                                      </span>
                                      <span className="truncate font-medium">{doctor.fullName}</span>
                                    </button>
                                  </li>
                                ))}
                              {doctors.filter(
                                (doctor) =>
                                  doctor.id !== selectedDoctorId &&
                                  !additionalDoctorIds.includes(doctor.id) &&
                                  doctor.fullName
                                    .toLowerCase()
                                    .includes(doctorSearchQuery.toLowerCase()),
                              ).length === 0 && (
                                <li className="px-3 py-4 text-center text-xs text-slate-400 italic">
                                  {doctorSearchQuery ? "No matching doctors" : "All doctors already added"}
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected doctors chips */}
                    {additionalDoctorIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {additionalDoctorIds.map((docId) => {
                          const doc = doctors.find((d) => d.id === docId);
                          if (!doc) return null;
                          return (
                            <span
                              key={docId}
                              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 py-1 pl-1 pr-2.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200/80 transition hover:ring-emerald-300"
                            >
                              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-200 text-[9px] font-bold text-emerald-800">
                                {doc.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                              </span>
                              {doc.fullName}
                              <button
                                type="button"
                                className="ml-0.5 inline-flex items-center justify-center rounded-full p-0.5 text-emerald-600 transition hover:bg-emerald-200 hover:text-emerald-900"
                                onClick={() => {
                                  const currentIds = form.getValues("additionalDoctorIds") || [];
                                  form.setValue("additionalDoctorIds", currentIds.filter((id) => id !== docId));
                                }}
                                aria-label={`Remove ${doc.fullName}`}
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Appointment Details
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      error={form.formState.errors.serviceId?.message}
                      label="Service"
                    >
                      <Select {...form.register("serviceId")}>
                        <option value="">Select service</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField
                      error={form.formState.errors.status?.message}
                      label="Status"
                    >
                      <Select {...form.register("status")}>
                        <option value="scheduled">Scheduled</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no_show">No show</option>
                      </Select>
                    </FormField>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      error={form.formState.errors.visitType?.message}
                      label="Visit type"
                    >
                      <Select {...form.register("visitType")}>
                        <option value="in_person">In person</option>
                        <option value="teleconsultation">
                          Teleconsultation
                        </option>
                      </Select>
                    </FormField>
                    <FormField
                      error={form.formState.errors.source?.message}
                      label="Source"
                    >
                      <Select {...form.register("source")}>
                        <option value="internal">Internal</option>
                        <option value="portal">Portal</option>
                      </Select>
                    </FormField>
                  </div>
                  <FormField
                    error={form.formState.errors.companyId?.message}
                    label="Company"
                  >
                    <Select {...form.register("companyId")}>
                      <option value="">No company / walk-in</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.companyName} ({company.companyCode})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  {/* Schedule date and time removed — walk-in / quick queue will auto-assign schedule */}
                </div>

                {visitType === "teleconsultation" ? (
                  <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Teleconsultation
                    </p>
                    <FormField label="Platform">
                      <Input
                        placeholder="Jitsi Meet"
                        {...form.register("teleconsultationPlatform")}
                      />
                    </FormField>
                    <FormField label="URL">
                      <Input
                        placeholder="https://..."
                        {...form.register("teleconsultationUrl")}
                      />
                    </FormField>
                    <FormField label="Access instructions">
                      <Textarea
                        placeholder="Tell the patient what to prepare before joining."
                        {...form.register("teleconsultationAccessInstructions")}
                      />
                    </FormField>
                  </div>
                ) : null}

                <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Notes
                  </p>
                  <FormField
                    error={form.formState.errors.reason?.message}
                    label="Reason for visit"
                  >
                    <Input {...form.register("reason")} />
                  </FormField>
                  <FormField
                    error={form.formState.errors.notes?.message}
                    label="Internal notes"
                  >
                    <Textarea {...form.register("notes")} />
                  </FormField>
                </div>
              </div>

              <div
                className={cn(
                  INTERNAL_SURFACE_FOOTER,
                  "flex flex-col-reverse gap-3 px-4 py-4 sm:flex-row sm:justify-end sm:px-6",
                )}
              >
                <Button
                  className="w-full sm:w-auto"
                  onClick={closeAppointmentModal}
                  type="button"
                  variant="tertiary"
                >
                  Cancel
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  disabled={
                    createAppointmentMutation.isPending ||
                    updateAppointmentMutation.isPending
                  }
                  type="submit"
                  variant="primary"
                >
                  {createAppointmentMutation.isPending ||
                  updateAppointmentMutation.isPending
                    ? "Saving..."
                    : editingAppointment
                      ? "Save Appointment"
                      : "Create Appointment"}
                </Button>
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
