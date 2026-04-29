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
import { Link } from "react-router-dom";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { FeedbackModal } from "../../components/ui/feedback-modal";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
  useDoctorDirectory,
  useServicesCatalog,
  useSpecialtiesCatalog,
} from "../../hooks/use-clinic-data";
import { formatDateTimeLabel } from "../../lib/utils";
import type { Appointment } from "../../types/domain";
import { usePatients } from "../patients/hooks/use-patients";
import { isTeleconsultJoinableStatus } from "../teleconsult/teleconsult-data";
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

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function AppointmentsPage() {
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
  const selectedDoctorId = useWatch({
    control: form.control,
    name: "doctorId",
  });
  const selectedServiceId = useWatch({
    control: form.control,
    name: "serviceId",
  });

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
      filteredAppointments.slice(
        pageStart,
        pageStart + APPOINTMENTS_PAGE_SIZE,
      ),
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

  const openCreateModal = () => {
    form.reset({
      patientId: patients[0]?.id ?? "",
      doctorId: doctors[0]?.id ?? "",
      specialtyId: defaultSpecialtyId,
      serviceId: services[0]?.id ?? "",
      scheduledAt: "2026-03-26T09:00",
      status: "scheduled",
      source: "internal",
      visitType: "in_person",
      reason: "",
      notes: "",
      teleconsultationPlatform: "Jitsi Meet",
      teleconsultationUrl: "",
      teleconsultationAccessInstructions: "",
    });
    setEditingAppointment(null);
    setIsAppointmentModalOpen(true);
  };

  const openEditModal = (appointment: Appointment) => {
    form.reset({
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      specialtyId: appointment.specialtyId,
      serviceId: appointment.serviceId,
      scheduledAt: toDateTimeLocalValue(appointment.scheduledAt),
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
    const payload = {
      patientId: values.patientId,
      doctorId: values.doctorId,
      specialtyId: values.specialtyId ?? "",
      serviceId: values.serviceId,
      scheduledAt: new Date(values.scheduledAt).toISOString(),
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
                onClick={openCreateModal}
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
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Doctor / Service
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Visit Type
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
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
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-950">
                            {patient?.firstName} {patient?.lastName}
                          </p>
                          <p className="text-sm text-slate-600">
                            {appointment.reason}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1 text-sm text-slate-600">
                          <p>{doctor?.fullName}</p>
                          <p>{service?.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">
                        {formatDateTimeLabel(appointment.scheduledAt)}
                      </td>
                      <td className="px-6 py-4 align-top">
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
                      <td className="px-6 py-4 align-top">
                        <StatusPill status={appointment.status} />
                      </td>
                      <td className="px-6 py-4 align-top">
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
                      className="px-6 py-10 text-center text-sm text-slate-500"
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
                    label="Scheduled time"
                  >
                    <Input
                      type="datetime-local"
                      {...form.register("scheduledAt")}
                    />
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
                    updateAppointmentMutation.isPending
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
