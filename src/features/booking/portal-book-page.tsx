import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
  useClinicSettingsData,
  useBookableServices,
  useDoctorAvailability,
  useDoctorDirectory,
} from "../../hooks/use-clinic-data";
import {
  buildDailyTimeSlots,
  formatTimeLabel,
  getAvailableTimeSlotsForDate,
  timeToMinutes,
  filterPastTimeSlots,
} from "../../lib/doctor-availability";
import type { BookingListItem } from "../../lib/supabase-clinic";
import { cn, formatCurrency, formatDateLabel } from "../../lib/utils";
import { useAuth } from "../auth/auth-context";
import { BookingReceiptCard } from "./components/booking-receipt-card";
import {
  useBlockedBookingSlots,
  useCreateBooking,
  useCurrentPatient,
  useMyBookings,
} from "./hooks/use-bookings";
import { listBookingsByPatientIdLiveOrDemo } from "../../lib/supabase-clinic";
import type { BookingPaymentStatus } from "../../types/domain";

const bookingSchema = z.object({
  serviceId: z.string().min(1),
  doctorId: z.string().optional(),
  preferredDate: z.string().min(1),
  preferredTime: z.string().min(1),
  intakeNotes: z.string().min(3),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

async function checkPatientHasPendingBookingForDate(
  patientId: string,
  date: string, // "YYYY-MM-DD"
): Promise<boolean> {
  const bookings = await listBookingsByPatientIdLiveOrDemo(patientId);

  for (const booking of bookings.filter((b) => b.preferredDate === date)) {
    const isPending =
      booking.status === "pending" || booking.status === "rescheduled";
    const hasAppointment = Boolean(booking.appointmentId);

    if (isPending && !hasAppointment) {
      return true;
    }
  }

  return false;
}
type TimeSession = "morning" | "afternoon" | "evening";

function isBookingPaymentStatus(value: string): value is BookingPaymentStatus {
  return value === "paid" || value === "pending_cashier";
}

function getTimeSession(time: string): TimeSession {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getTimeSessionLabel(session: TimeSession) {
  if (session === "morning") return "Morning";
  if (session === "afternoon") return "Afternoon";
  return "Evening";
}

export function PortalBookPage() {
  const { profile, session } = useAuth();
  const [submittedBooking, setSubmittedBooking] =
    useState<BookingListItem | null>(null);
  const [selectedTimeSession, setSelectedTimeSession] =
    useState<TimeSession | null>(null);
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: services = [] } = useBookableServices();
  const { data: doctors = [] } = useDoctorDirectory();
  const directBookableDoctors = useMemo(
    () => doctors.filter((doctor) => doctor.role === "doctor"),
    [doctors],
  );
  const { data: currentPatient } = useCurrentPatient(
    session?.user.id ?? null,
    profile?.email,
  );
  const { data: existingBookings = [] } = useMyBookings(
    session?.user.id ?? profile?.email ?? null,
  );
  const createBooking = useCreateBooking(session?.user.id ?? null);

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      serviceId: "",
      doctorId: "",
      preferredDate: "",
      preferredTime: "",
      intakeNotes: "",
    },
  });

  const selectedServiceId = form.watch("serviceId");
  const selectedDoctorId = form.watch("doctorId");
  const selectedDate = form.watch("preferredDate");
  const selectedPreferredTime = form.watch("preferredTime");
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;
  const requiresDoctor =
    selectedService?.serviceType === "consultation" ||
    selectedService?.serviceType === "follow_up";
  const { data: doctorAvailability = [] } = useDoctorAvailability(
    requiresDoctor ? selectedDoctorId || null : null,
  );
  const selectedDoctor =
    directBookableDoctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const selectedFeeAmount = selectedService
    ? selectedService.serviceType === "follow_up"
      ? (selectedDoctor?.followUpFee ?? 0)
      : selectedService.serviceType === "consultation"
        ? (selectedDoctor?.consultationFee ?? 0)
        : selectedService.price
    : 0;
  const derivedFeeType =
    selectedService?.serviceType === "follow_up"
      ? "follow_up"
      : selectedService?.serviceType === "consultation"
        ? "consultation"
        : "service_fee";
  const { data: blockedSlots = [] } = useBlockedBookingSlots({
    date: selectedDate || null,
    doctorId: requiresDoctor ? selectedDoctorId || null : null,
    serviceId: !requiresDoctor ? selectedServiceId || null : null,
  });
  const unfinishedBooking = useMemo(
    () =>
      existingBookings.find(
        (booking) =>
          booking.status !== "cancelled" && booking.status !== "confirmed",
      ) ?? null,
    [existingBookings],
  );

  const allTimeSlots = useMemo(() => {
    if (!selectedDate || !selectedService) {
      return [];
    }

    return requiresDoctor
      ? getAvailableTimeSlotsForDate(doctorAvailability, selectedDate)
      : buildDailyTimeSlots(
          selectedService.durationMinutes ||
            clinicSettings?.appointmentSlotMinutes ||
            30,
        );
  }, [
    clinicSettings?.appointmentSlotMinutes,
    doctorAvailability,
    requiresDoctor,
    selectedDate,
    selectedService,
  ]);

  const availableTimeSlots = useMemo(
    () =>
      filterPastTimeSlots(
        allTimeSlots.filter((time) => !blockedSlots.includes(time)),
        selectedDate,
      ),
    [allTimeSlots, blockedSlots, selectedDate],
  );

  const timeSessionOptions = useMemo(() => {
    const sessionOrder: TimeSession[] = ["morning", "afternoon", "evening"];

    return sessionOrder.filter((sessionValue) =>
      allTimeSlots.some((time) => getTimeSession(time) === sessionValue),
    );
  }, [allTimeSlots]);

  const unavailableTimeSessions = useMemo(() => {
    const sessionOrder: TimeSession[] = ["morning", "afternoon", "evening"];

    if (!requiresDoctor) {
      return [];
    }

    return sessionOrder.filter(
      (sessionValue) => !timeSessionOptions.includes(sessionValue),
    );
  }, [requiresDoctor, timeSessionOptions]);

  const displayedTimeSlots = useMemo(() => {
    if (!selectedTimeSession) {
      return [];
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = selectedDate === todayStr;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return allTimeSlots
      .filter((time) => getTimeSession(time) === selectedTimeSession)
      .map((time) => {
        const isPast = isToday && timeToMinutes(time) <= currentMinutes;
        const isBooked = blockedSlots.includes(time) || isPast;
        return {
          time,
          isBooked,
          isAvailable: !isBooked,
          isPast,
        };
      });
  }, [allTimeSlots, blockedSlots, selectedDate, selectedTimeSession]);

  useEffect(() => {
    if (services[0] && !form.getValues("serviceId")) {
      form.setValue("serviceId", services[0].id);
    }
  }, [form, services]);

  useEffect(() => {
    if (!requiresDoctor) {
      if (form.getValues("doctorId")) {
        form.setValue("doctorId", "");
      }
      return;
    }

    if (directBookableDoctors[0] && !form.getValues("doctorId")) {
      form.setValue("doctorId", directBookableDoctors[0].id);
    }
  }, [directBookableDoctors, form, requiresDoctor]);

  useEffect(() => {
    const currentPreferredTime = form.getValues("preferredTime");
    if (availableTimeSlots.length === 0) {
      if (currentPreferredTime) {
        form.setValue("preferredTime", "");
      }
      return;
    }

    if (!availableTimeSlots.includes(currentPreferredTime)) {
      form.setValue("preferredTime", availableTimeSlots[0]);
    }
  }, [availableTimeSlots, form]);

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

    setSelectedTimeSession(timeSessionOptions[0]);
  }, [timeSessionOptions]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!currentPatient) {
      toast.error(
        "Your patient profile is not ready yet. Please sign in again or contact the clinic.",
      );
      return;
    }

    if (unfinishedBooking) {
      toast.error(
        `You already have an unfinished booking for ${unfinishedBooking.serviceName} on ${formatDateLabel(unfinishedBooking.preferredDate)} at ${unfinishedBooking.preferredTime}. Please complete or cancel that booking first.`,
      );
      return;
    }

    if (requiresDoctor && !values.doctorId) {
      toast.error(
        "Please select a doctor for consultation or follow-up booking.",
      );
      return;
    }

    if (requiresDoctor && selectedFeeAmount <= 0) {
      toast.error(
        "The selected doctor has no professional fee set yet. Please choose another doctor or contact the clinic.",
      );
      return;
    }

    if (values.preferredDate < today) {
      toast.error("Please select today or a future date for your booking.");
      return;
    }

    const hasPendingBookingForDate = await checkPatientHasPendingBookingForDate(
      currentPatient.id,
      values.preferredDate,
    );
    if (hasPendingBookingForDate) {
      toast.error(
        "You have a pending or rescheduled booking for this date. Please finalize your existing checkout before creating a new booking.",
      );
      return;
    }

    const createdBooking = await createBooking.mutateAsync({
      patientId: currentPatient.id,
      serviceId: values.serviceId,
      doctorId: requiresDoctor ? (values.doctorId ?? "") : "",
      preferredDate: values.preferredDate,
      preferredTime: values.preferredTime,
      intakeNotes: values.intakeNotes,
      feeType: derivedFeeType,
      feeAmount: selectedFeeAmount,
      receiptCode: "",
      paymentStatus: "pending_cashier",
    });

    const receiptCode: string =
      "receipt_code" in createdBooking
        ? String(createdBooking.receipt_code ?? "")
        : String(createdBooking.receiptCode ?? "");
    const bookingStatus =
      "status" in createdBooking && typeof createdBooking.status === "string"
        ? createdBooking.status
        : "pending";
    const paymentStatus: BookingPaymentStatus =
      "payment_status" in createdBooking &&
      typeof createdBooking.payment_status === "string" &&
      isBookingPaymentStatus(createdBooking.payment_status)
        ? createdBooking.payment_status
        : "paymentStatus" in createdBooking &&
            typeof createdBooking.paymentStatus === "string" &&
            isBookingPaymentStatus(createdBooking.paymentStatus)
          ? createdBooking.paymentStatus
          : "pending_cashier";
    const createdAt =
      "created_at" in createdBooking &&
      typeof createdBooking.created_at === "string"
        ? createdBooking.created_at
        : "createdAt" in createdBooking &&
            typeof createdBooking.createdAt === "string"
          ? createdBooking.createdAt
          : new Date().toISOString();

    setSubmittedBooking({
      id:
        "id" in createdBooking && typeof createdBooking.id === "string"
          ? createdBooking.id
          : crypto.randomUUID(),
      patientId: currentPatient.id,
      serviceId: values.serviceId,
      serviceName: selectedService?.name ?? "Booked medical service",
      doctorId: requiresDoctor ? (values.doctorId ?? null) : null,
      doctorName: requiresDoctor
        ? (selectedDoctor?.fullName ?? "Assigned doctor")
        : null,
      preferredDate: values.preferredDate,
      preferredTime: values.preferredTime,
      status: bookingStatus,
      intakeNotes: values.intakeNotes,
      createdAt,
      feeType: derivedFeeType,
      feeAmount: selectedFeeAmount,
      receiptCode,
      paymentStatus,
    });

    toast.success(
      `Booking submitted. Present receipt ${receiptCode} at cashier before proceeding to staff.`,
    );
    form.reset({
      serviceId: values.serviceId,
      doctorId: requiresDoctor ? values.doctorId : "",
      preferredDate: "",
      preferredTime: "",
      intakeNotes: "",
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <Badge intent="info">Booking portal</Badge>
        <CardTitle className="mt-4 text-3xl">Book a medical service</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          You are signed in as {profile?.fullName ?? profile?.email}.
          Consultation and follow-up fees follow the doctor&apos;s professional
          fees, while other services use the catalog service fee.
        </p>

        {unfinishedBooking ? (
          <div className="mt-5 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">
              You already have an unfinished booking.
            </p>
            <p className="mt-1">
              Current booking: {unfinishedBooking.serviceName} on{" "}
              {formatDateLabel(unfinishedBooking.preferredDate)} at{" "}
              {unfinishedBooking.preferredTime}. You cannot submit another
              booking until this one is completed or cancelled.
            </p>
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Service">
              <Select {...form.register("serviceId")}>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Service type">
              <Input
                disabled
                readOnly
                value={
                  selectedService?.serviceType === "consultation"
                    ? "Consultation"
                    : ""
                }
              />
            </FormField>
          </div>

          {requiresDoctor ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Doctor">
                <Select {...form.register("doctorId")}>
                  <option value="">Select doctor</option>
                  {directBookableDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                      {doctor.specialtyName ? ` (${doctor.specialtyName})` : ""}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Charge type">
                <Input
                  disabled
                  readOnly
                  value={
                    selectedService?.serviceType === "follow_up"
                      ? "Follow-up Fee"
                      : "Consultation Fee"
                  }
                />
              </FormField>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Preferred date">
              {/* min locks the calendar to today and onwards in the browser UI.
                  The onSubmit guard below catches any bypass attempt. */}
              <Input
                type="date"
                min={today}
                {...form.register("preferredDate")}
              />
            </FormField>
            <FormField
              label="Time of day"
              hint={
                selectedDate
                  ? requiresDoctor
                    ? "Only sessions with doctor availability are shown."
                    : "Choose a session to view exact time slots."
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
                    {selectedDate
                      ? "No sessions available for the selected date."
                      : "Select a date first."}
                  </div>
                )}
              </div>
              {selectedDate &&
              requiresDoctor &&
              unavailableTimeSessions.length > 0 ? (
                <p className="mt-3 text-xs text-slate-500">
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
          </div>

          <FormField
            label="Available time slots"
            hint={
              selectedTimeSession
                ? `${getTimeSessionLabel(selectedTimeSession)} schedule for the selected date.`
                : "Choose a time of day to see exact slots."
            }
          >
            <input type="hidden" {...form.register("preferredTime")} />
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
                    const isSelected = selectedPreferredTime === time;
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
                        // INSTEAD, sync the session inside the slot button's onClick
                        onClick={() => {
                          form.setValue("preferredTime", time, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          // Sync session tab to match the chosen slot
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

          <FormField label="Booking charge">
            <Input
              disabled
              readOnly
              value={
                requiresDoctor && !selectedDoctor
                  ? "Select a doctor first"
                  : selectedService
                    ? formatCurrency(selectedFeeAmount)
                    : "Select a service first"
              }
            />
          </FormField>

          {selectedDate &&
          allTimeSlots.length > 0 &&
          availableTimeSlots.length === 0 ? (
            <p className="text-sm font-medium text-rose-600">
              This time slot set is already full or unavailable for the selected
              date.
            </p>
          ) : null}

          <FormField label="Reason or intake notes">
            <Textarea {...form.register("intakeNotes")} />
          </FormField>
          <Button
            className="w-full"
            disabled={
              createBooking.isPending ||
              !currentPatient ||
              Boolean(unfinishedBooking) ||
              !selectedPreferredTime ||
              blockedSlots.includes(selectedPreferredTime) ||
              (requiresDoctor && !selectedDoctorId) ||
              !availableTimeSlots.includes(selectedPreferredTime)
            }
            type="submit"
          >
            {createBooking.isPending
              ? "Submitting..."
              : "Submit booking request"}
          </Button>
        </form>
      </Card>

      <div className="space-y-6">
        {submittedBooking ? (
          <Card className="border-orange-200 bg-orange-50/40">
            <Badge intent="success">Latest booking receipt</Badge>
            <CardTitle className="mt-4 text-2xl">
              Booking submitted successfully
            </CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              Review the summary below, then save a copy to your phone as an
              image or PDF before arriving at the clinic.
            </p>

            <div className="mt-5 grid gap-4 rounded-3xl border border-orange-100 bg-white p-5 text-sm text-slate-700">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                  Service
                </p>
                <p className="mt-1 text-base font-bold text-slate-950">
                  {submittedBooking.serviceName}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                    Doctor / Provider
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {submittedBooking.doctorName ?? "Clinic medical service"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                    Schedule
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatDateLabel(submittedBooking.preferredDate)} at{" "}
                    {submittedBooking.preferredTime}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                    Booking charge
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatCurrency(submittedBooking.feeAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                    Payment
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {submittedBooking.paymentStatus === "paid"
                      ? "Paid at cashier"
                      : "Pending cashier payment"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                  Reason / Notes
                </p>
                <p className="mt-1 leading-relaxed text-slate-700">
                  {submittedBooking.intakeNotes}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <BookingReceiptCard booking={submittedBooking} />
            </div>
          </Card>
        ) : null}

        <Card>
          <CardTitle>After booking</CardTitle>
          <div className="mt-5 space-y-4 text-sm text-slate-600">
            <p>
              Once booked, the slot is blocked so another patient cannot take
              the same date and time.
            </p>
            <p>
              Your booking receipt will also appear in{" "}
              <Link
                className="font-semibold text-[var(--color-primary)]"
                to="/portal/my-bookings"
              >
                My Bookings
              </Link>{" "}
              with a QR code for cashier and staff scanning.
            </p>
            <p>
              Patients must present the receipt to cashier first, complete
              payment, then proceed to staff for the actual test or service.
            </p>
            <p>
              Need to update your details first? Return to the{" "}
              <Link
                className="font-semibold text-[var(--color-primary)]"
                to="/portal"
              >
                patient portal
              </Link>
              .
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
