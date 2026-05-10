import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarCheck2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { FeedbackModal } from "../../components/ui/feedback-modal";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
  useClinicSettingsData,
  useDoctorDirectory,
  useDoctorAvailability,
  useServicesCatalog,
  useSpecialtiesCatalog,
} from "../../hooks/use-clinic-data";
import {
  buildDailyTimeSlots,
  formatTimeLabel,
  getAvailableTimeSlotsForDate,
  timeToMinutes,
} from "../../lib/doctor-availability";
import {
  cn,
  formatDateTimeLabel,
  getPhilippineDateKey,
  getPhilippineTimeKey,
  toPhilippineDateTimeLocalValue,
  toUtcIsoFromPhilippineDateTime,
} from "../../lib/utils";
import type { Appointment } from "../../types/domain";
import { usePatients } from "../patients/hooks/use-patients";
import { isTeleconsultJoinableStatus } from "../teleconsult/teleconsult-data";
import { useBlockedBookingSlots } from "../booking/hooks/use-bookings";
import {
  useAppointments,
  useCreateAppointment,
  useDeleteAppointment,
  useUpdateAppointment,
} from "./hooks/use-appointments";

const appointmentSchema = z.object({
  patientId: z.string().min(1, "Patient is required."),
  doctorId: z.string().min(1, "Doctor is required."),
  specialtyId: z.string().optional(),
  serviceId: z.string().min(1, "Service is required."),
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
});

const APPOINTMENTS_PAGE_SIZE = 10;

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: "success" | "error";
}

type TimeSession = "morning" | "afternoon" | "evening";

function getTimeSession(time: string): TimeSession {
  const hour = Number(time.split(":")[0]);

  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getTimeSessionLabel(session: TimeSession) {
  if (session === "morning") return "Morning";
  if (session === "afternoon") return "Afternoon";
  return "Evening";
}

function normalizeBlockedSlotTime(value: unknown) {
  if (typeof value !== "string") return "";
  return value.slice(0, 5);
}

function getDefaultScheduledAtValue() {
  return `${getPhilippineDateKey()}T${getPhilippineTimeKey().slice(0, 5)}`;
}

function StatusPill({ status }: { status: string }) {
  const label = status.replace("_", " ");
  if (status === "confirmed" || status === "completed") {
    return (
      <span className="bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
        {label}
      </span>
    );
  }
  if (status === "cancelled" || status === "no_show") {
    return (
      <span className="bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-rose-700">
        {label}
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="bg-sky-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-sky-700">
        {label}
      </span>
    );
  }
  return (
    <span className="bg-orange-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
      {label}
    </span>
  );
}

export function AppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: appointments = [] } = useAppointments();
  const { data: patients = [] } = usePatients();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: services = [] } = useServicesCatalog();
  const { data: specialties = [] } = useSpecialtiesCatalog();
  const createAppointmentMutation = useCreateAppointment();
  const updateAppointmentMutation = useUpdateAppointment();
  const deleteAppointmentMutation = useDeleteAppointment();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [selectedTimeSession, setSelectedTimeSession] =
    useState<TimeSession | null>(null);
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
      scheduledAt: "2026-03-26T09:00",
      status: "scheduled",
      source: "internal",
      visitType: "in_person",
      reason: "",
      notes: "",
      teleconsultationPlatform: "Jitsi Meet",
      teleconsultationUrl: "",
      teleconsultationAccessInstructions: "",
    },
  });

  const visitType = useWatch({ control: form.control, name: "visitType" });
  const scheduledAtValue = useWatch({ control: form.control, name: "scheduledAt" });
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
  const { data: blockedSlots = [] } = useBlockedBookingSlots({
    date: selectedScheduleDate || null,
    doctorId: selectedDoctorId || null,
    serviceId: selectedServiceId || null,
  });
  const normalizedBlockedSlots = useMemo(
    () => blockedSlots.map(normalizeBlockedSlotTime),
    [blockedSlots],
  );
  const allTimeSlots = useMemo(() => {
    if (!selectedScheduleDate || !selectedDoctorId) {
      return [];
    }

    if (doctorAvailability.length > 0) {
      return getAvailableTimeSlotsForDate(doctorAvailability, selectedScheduleDate);
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

    const slots = allTimeSlots.filter(
      (time) =>
        !normalizedBlockedSlots.includes(time) ||
        (isEditingCurrentScheduledAt && time === selectedScheduleTime),
    );

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
    normalizedBlockedSlots,
    selectedScheduleDate,
    selectedScheduleTime,
    todayDateKey,
  ]);
  const selectedTimeIsBlocked =
    Boolean(selectedScheduleTime) &&
    normalizedBlockedSlots.includes(selectedScheduleTime) &&
    !isEditingCurrentScheduledAt;
  const selectedDateIsPast =
    Boolean(selectedScheduleDate) &&
    selectedScheduleDate < todayDateKey &&
    !isEditingCurrentScheduledAt;
  const selectedTimeIsPast =
    Boolean(selectedScheduleDate && selectedScheduleTime) &&
    selectedScheduleDate === todayDateKey &&
    timeToMinutes(selectedScheduleTime) <= currentTimeMinutes &&
    !isEditingCurrentScheduledAt;
  const timeSessionOptions = useMemo(() => {
    const sessionOrder: TimeSession[] = ["morning", "afternoon", "evening"];

    return sessionOrder.filter((sessionValue) =>
      allTimeSlots.some((time) => getTimeSession(time) === sessionValue),
    );
  }, [allTimeSlots]);
  const unavailableTimeSessions = useMemo(() => {
    const sessionOrder: TimeSession[] = ["morning", "afternoon", "evening"];

    return sessionOrder.filter(
      (sessionValue) => !timeSessionOptions.includes(sessionValue),
    );
  }, [timeSessionOptions]);
  const displayedTimeSlots = useMemo(() => {
    if (!selectedTimeSession) {
      return [];
    }

    return allTimeSlots
      .filter((time) => getTimeSession(time) === selectedTimeSession)
      .map((time) => {
        const isPast =
          selectedScheduleDate === todayDateKey &&
          timeToMinutes(time) <= currentTimeMinutes;
        const isBooked =
          (normalizedBlockedSlots.includes(time) &&
            !(isEditingCurrentScheduledAt && time === selectedScheduleTime)) ||
          (isPast && !(isEditingCurrentScheduledAt && time === selectedScheduleTime));

        return {
          time,
          isBooked,
          isAvailable: !isBooked,
          isPast,
        };
      });
  }, [
    allTimeSlots,
    currentTimeMinutes,
    isEditingCurrentScheduledAt,
    normalizedBlockedSlots,
    selectedScheduleDate,
    selectedScheduleTime,
    selectedTimeSession,
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
        const patient = patientMap.get(appointment.patientId);
        const doctor = doctorMap.get(appointment.doctorId);
        const service = serviceMap.get(appointment.serviceId);
        const specialty = specialtyMap.get(appointment.specialtyId);

        return `${patient?.firstName ?? ""} ${patient?.lastName ?? ""} ${doctor?.fullName ?? ""} ${service?.name ?? ""} ${specialty?.name ?? ""} ${appointment.status} ${appointment.visitType} ${appointment.reason}`
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
    if (timeSessionOptions.length === 0) {
      setSelectedTimeSession(null);
      return;
    }

    if (
      selectedTimeSession &&
      timeSessionOptions.includes(selectedTimeSession)
    ) {
      return;
    }

    const currentSession = selectedScheduleTime
      ? getTimeSession(selectedScheduleTime)
      : null;

    if (currentSession && timeSessionOptions.includes(currentSession)) {
      setSelectedTimeSession(currentSession);
      return;
    }

    setSelectedTimeSession(timeSessionOptions[0]);
  }, [selectedScheduleTime, selectedTimeSession, timeSessionOptions]);

  useEffect(() => {
    if (!selectedScheduleDate) {
      return;
    }

    if (availableTimeSlots.length === 0) {
      if (!isEditingCurrentScheduledAt && scheduledAtValue) {
        form.setValue("scheduledAt", "", {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (availableTimeSlots.includes(selectedScheduleTime)) {
      return;
    }

    form.setValue("scheduledAt", `${selectedScheduleDate}T${availableTimeSlots[0]}`, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
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
    form.reset({
      patientId: selectedPatientId,
      doctorId: doctors[0]?.id ?? "",
      specialtyId: defaultSpecialtyId,
      serviceId: services[0]?.id ?? "",
      scheduledAt: defaultScheduledAt,
      status: "scheduled",
      source: source ?? "internal",
      visitType: "in_person",
      reason: "",
      notes: "",
      teleconsultationPlatform: "Jitsi Meet",
      teleconsultationUrl: "",
      teleconsultationAccessInstructions: "",
    });
    setSelectedTimeSession(getTimeSession(defaultScheduledAt.slice(11, 16)));
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
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      specialtyId: appointment.specialtyId,
      serviceId: appointment.serviceId,
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
    });
    setSelectedTimeSession(getTimeSession(scheduledAt.slice(11, 16)));
    setEditingAppointment(appointment);
    setIsAppointmentModalOpen(true);
  };

  const closeAppointmentModal = () => {
    setEditingAppointment(null);
    setIsAppointmentModalOpen(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!values.scheduledAt) {
      toast.error("Please choose an available schedule date and time.");
      return;
    }

    if (selectedDateIsPast) {
      toast.error("Please select today or a future date for this appointment.");
      return;
    }

    if (selectedTimeIsBlocked) {
      toast.error(
        "The selected time is no longer available. Please choose another slot.",
      );
      return;
    }

    if (selectedTimeIsPast) {
      toast.error(
        "The selected time is already in the past. Please choose a later slot.",
      );
      return;
    }

    if (availableTimeSlots.length === 0 && !isEditingCurrentScheduledAt) {
      toast.error("No available slots for the selected doctor and date.");
      return;
    }

    const payload = {
      patientId: values.patientId,
      doctorId: values.doctorId,
      specialtyId: values.specialtyId ?? "",
      serviceId: values.serviceId,
      scheduledAt: toUtcIsoFromPhilippineDateTime(values.scheduledAt),
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
    };

    try {
      if (editingAppointment) {
        await updateAppointmentMutation.mutateAsync({
          appointmentId: editingAppointment.id,
          payload,
        });
        setFeedbackModal({
          open: true,
          title: "Appointment updated",
          message: "The appointment details were updated successfully.",
          variant: "success",
        });
      } else {
        await createAppointmentMutation.mutateAsync(payload);
        setFeedbackModal({
          open: true,
          title: "Appointment created",
          message: "The new appointment has been added to the schedule.",
          variant: "success",
        });
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
    const patient = patientMap.get(appointment.patientId);
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
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <CalendarCheck2 className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                  Operations
                </p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
                  Appointments and Queue
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage in-person and teleconsultation appointments from one
                  schedule table.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                intent="info"
                className="rounded-none text-[10px] font-bold uppercase tracking-widest"
              >
                Teleconsultation-ready
              </Badge>
              <Button
                className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700"
                onClick={() => openCreateModal()}
              >
                <Plus className="mr-2 size-4" />
                New appointment
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
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
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
            <span className="text-xs font-bold text-slate-500">
              {filteredAppointments.length} appointment
              {filteredAppointments.length !== 1 ? "s" : ""} found
            </span>
          </div>
        </div>

        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Patient
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Doctor / Service
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Schedule
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Visit Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAppointments.map((appointment) => {
                  const patient = patientMap.get(appointment.patientId);
                  const doctor = doctorMap.get(appointment.doctorId);
                  const service = serviceMap.get(appointment.serviceId);

                  return (
                    <tr
                      className="transition-colors hover:bg-slate-50"
                      key={appointment.id}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-950">
                            {patient?.firstName} {patient?.lastName}
                          </p>
                          <p className="text-sm text-slate-600">
                            {appointment.reason}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1 text-sm text-slate-600">
                          <p>{doctor?.fullName}</p>
                          <p>{service?.name}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-slate-600">
                        {formatDateTimeLabel(appointment.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          {appointment.visitType === "teleconsultation" ? (
                            <span className="inline-flex items-center gap-1 bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-sky-700">
                              <Video className="size-3" />
                              Teleconsultation
                            </span>
                          ) : (
                            <span className="bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
                              In Person
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusPill status={appointment.status} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                          <button
                            className="inline-flex items-center gap-1 text-slate-600 hover:underline"
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
                              className="inline-flex items-center text-sky-700 hover:underline"
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
                      className="px-4 py-8 text-center text-sm text-slate-500"
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <p className="text-xs font-semibold text-slate-500">
                Showing {showingStart}-{showingEnd} of{" "}
                {filteredAppointments.length} appointments
              </p>
              <div className="flex items-center gap-2">
                <Button
                  className="rounded-none border-slate-300 px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  disabled={safeCurrentPage <= 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
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
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  type="button"
                  variant="secondary"
                >
                  Next
                </Button>
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
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-orange-600 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">
                  Appointment Form
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {editingAppointment
                    ? "Edit Appointment"
                    : "Schedule Appointment"}
                </p>
                <p className="mt-2 max-w-2xl text-sm text-orange-50">
                  Manage the patient, provider, schedule, and teleconsult
                  details from this modal.
                </p>
              </div>
              <button
                aria-label="Close appointment modal"
                className="inline-flex shrink-0 items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeAppointmentModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    Patient and Provider
                  </p>
                  <FormField
                    error={form.formState.errors.patientId?.message}
                    label="Patient"
                  >
                    <Select {...form.register("patientId")}>
                      <option value="">Select patient</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      error={form.formState.errors.doctorId?.message}
                      label="Doctor"
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
                </div>

                <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
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
                    error={form.formState.errors.scheduledAt?.message}
                    label="Schedule date"
                    hint="Pick a date, then choose from the doctor's available time slots below."
                  >
                    <Input
                      min={todayDateKey}
                      type="date"
                      value={selectedScheduleDate}
                      onChange={(event) => {
                        const nextDate = event.target.value;
                        const currentTime =
                          form.getValues("scheduledAt")?.slice(11, 16) ||
                          availableTimeSlots[0] ||
                          getPhilippineTimeKey().slice(0, 5);

                        form.setValue(
                          "scheduledAt",
                          nextDate ? `${nextDate}T${currentTime}` : "",
                          {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          },
                        );
                      }}
                    />
                  </FormField>

                  <FormField
                    label="Time of day"
                    hint={
                      selectedScheduleDate
                        ? "Only sessions with doctor availability are shown."
                        : "Select a date first to load available sessions."
                    }
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {timeSessionOptions.length > 0 ? (
                        timeSessionOptions.map((sessionValue) => {
                          const isActive = selectedTimeSession === sessionValue;

                          return (
                            <button
                              key={sessionValue}
                              className={cn(
                                "rounded-sm border px-3 py-3 text-sm font-semibold transition",
                                isActive
                                  ? "border-orange-300 bg-orange-50 text-orange-700"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/40",
                              )}
                              onClick={() => setSelectedTimeSession(sessionValue)}
                              type="button"
                            >
                              {getTimeSessionLabel(sessionValue)}
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-sm border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400 sm:col-span-3">
                          {selectedScheduleDate
                            ? "No sessions available for the selected date."
                            : "Select a date first."}
                        </div>
                      )}
                    </div>
                    {selectedScheduleDate && unavailableTimeSessions.length > 0 ? (
                      <p className="mt-3 rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                        Doctor not available during{" "}
                        {unavailableTimeSessions
                          .map((sessionValue) =>
                            getTimeSessionLabel(sessionValue).toLowerCase(),
                          )
                          .join(", ")}
                        .
                      </p>
                    ) : null}
                  </FormField>

                  <FormField
                    label="Available time slots"
                    hint={
                      selectedTimeSession
                        ? `${getTimeSessionLabel(selectedTimeSession)} schedule for the selected date.`
                        : "Choose a time of day to see exact slots."
                    }
                  >
                    <input type="hidden" {...form.register("scheduledAt")} />
                    <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-3 rounded-full bg-emerald-500" />
                          Available
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span className="size-3 rounded-full bg-rose-400" />
                          Booked
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span className="size-3 rounded-full bg-orange-500" />
                          Selected
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {displayedTimeSlots.length > 0 ? (
                          displayedTimeSlots.map(({ time, isAvailable, isBooked }) => {
                            const isSelected = selectedScheduleTime === time;

                            return (
                              <button
                                key={time}
                                className={cn(
                                  "rounded-sm border px-3 py-3 text-sm font-semibold transition",
                                  isSelected
                                    ? "border-orange-300 bg-orange-50 text-orange-700"
                                    : isAvailable
                                      ? "border-emerald-200 bg-white text-slate-800 hover:border-emerald-400 hover:bg-emerald-50"
                                      : "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-500 opacity-80",
                                )}
                                disabled={isBooked}
                                onClick={() => {
                                  form.setValue(
                                    "scheduledAt",
                                    `${selectedScheduleDate}T${time}`,
                                    {
                                      shouldDirty: true,
                                      shouldTouch: true,
                                      shouldValidate: true,
                                    },
                                  );
                                  setSelectedTimeSession(getTimeSession(time));
                                }}
                                type="button"
                              >
                                {formatTimeLabel(time)}
                              </button>
                            );
                          })
                        ) : (
                          <div className="col-span-full rounded-sm border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-400">
                            {selectedTimeSession
                              ? `No ${getTimeSessionLabel(selectedTimeSession).toLowerCase()} slots available for this date.`
                              : "Choose a time of day to view exact slots."}
                          </div>
                        )}
                      </div>
                    </div>
                  </FormField>
                </div>

                {visitType === "teleconsultation" ? (
                  <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
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
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
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

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button
                  className="w-full rounded-none sm:w-auto"
                  onClick={closeAppointmentModal}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="w-full rounded-none bg-orange-600 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700 sm:w-auto"
                  disabled={
                    createAppointmentMutation.isPending ||
                    updateAppointmentMutation.isPending ||
                    !selectedScheduleDate ||
                    !selectedScheduleTime ||
                    selectedTimeIsBlocked ||
                    selectedDateIsPast ||
                    selectedTimeIsPast ||
                    (availableTimeSlots.length === 0 &&
                      !isEditingCurrentScheduledAt)
                  }
                  type="submit"
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
