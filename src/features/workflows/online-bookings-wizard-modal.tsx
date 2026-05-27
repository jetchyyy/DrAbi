import {
  AlertCircle,
  Loader2,
  Send,
  Stethoscope,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { StatusPill } from "../../components/ui/status-pill";
import { queryClient } from "../../app/query-client";
import { queryKeys } from "../../lib/query-keys";
import { evaluateVitalsAlerts, type VitalAlert } from "../../lib/vitals-alerts";
import { cn, formatCurrency, formatDateTimeLabel } from "../../lib/utils";
import {
  markBookingPaidAndCreateInvoiceLiveOrDemo,
  updateAppointmentStatusAndNotesLiveOrDemo,
} from "../../lib/supabase-clinic";
import {
  useUpdateBookingStatus,
  type PatientBookingRow,
} from "../appointments/hooks/use-patients-booking";
import { usePatientDetail, useUpdatePatient } from "../patients/hooks/use-patients";
import type { Patient } from "../../types/domain";

type OnlineBookingVitalsValues = {
  temperature: string;
  bloodPressure: string;
  heartRate: string;
  o2Sat: string;
  respiratoryRate: string;
  weight: string;
  height: string;
};

type OnlineBookingStage = "confirm" | "vitals" | "billing" | "complete";

type OnlineBookingResult = {
  invoiceNumber: string | null;
  appointmentId: string | null;
};

type BookingInvoiceShape = {
  appointmentId?: string | null;
  appointment_id?: string | null;
  invoiceNumber?: string;
  invoice_number?: string;
} | null;

const EMPTY_VITALS: OnlineBookingVitalsValues = {
  temperature: "",
  bloodPressure: "",
  heartRate: "",
  o2Sat: "",
  respiratoryRate: "",
  weight: "",
  height: "",
};

function hasVitals(values: OnlineBookingVitalsValues) {
  return Object.values(values).some((value) => value.trim().length > 0);
}

function getBookingFeeLabel(booking: PatientBookingRow) {
  if (booking.feeType === "follow_up") {
    return "Follow-up Fee";
  }

  if (booking.feeType === "consultation") {
    return "Consultation Fee";
  }

  return booking.serviceName || "Service Fee";
}

function buildVitalsSeed(patient: Patient | null | undefined): OnlineBookingVitalsValues {
  return {
    temperature: patient?.temperature ?? "",
    bloodPressure: patient?.bloodPressure ?? "",
    heartRate: patient?.heartRate ?? "",
    o2Sat: patient?.o2Sat ?? "",
    respiratoryRate: patient?.respiratoryRate ?? "",
    weight: patient?.weight ?? "",
    height: patient?.height ?? "",
  };
}

function normalizeBookingInvoice(invoice: BookingInvoiceShape): OnlineBookingResult {
  return {
    invoiceNumber: invoice?.invoiceNumber ?? invoice?.invoice_number ?? null,
    appointmentId: invoice?.appointmentId ?? invoice?.appointment_id ?? null,
  };
}

function formatBookingDateTime(preferredDate: string, preferredTime: string) {
  if (!preferredDate || !preferredTime) {
    return "Schedule unavailable";
  }

  const value = new Date(`${preferredDate}T${preferredTime}:00`);
  if (Number.isNaN(value.getTime())) {
    return `${preferredDate} ${preferredTime}`;
  }

  return formatDateTimeLabel(value.toISOString());
}

function getAlertSeverityClasses(level: VitalAlert["level"]) {
  if (level === "critical") {
    return {
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      text: "text-rose-700",
      ring: "border-rose-300 focus:!border-rose-500 focus:!ring-rose-500/20",
      panel: "border-rose-200 bg-rose-50 text-rose-900",
    };
  }

  if (level === "warning") {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      text: "text-amber-700",
      ring: "border-amber-300 focus:!border-amber-500 focus:!ring-amber-500/20",
      panel: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  return {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
    ring: "border-emerald-300 focus:!border-emerald-500 focus:!ring-emerald-500/20",
    panel: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
}

function BookingPaymentPill({ status }: { status: PatientBookingRow["paymentStatus"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ring-1",
        status === "paid"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-amber-200",
      )}
    >
      {status === "paid" ? "Paid" : "Pending cashier"}
    </span>
  );
}

export function OnlineBookingWizardModal({
  open,
  booking,
  onClose,
}: {
  open: boolean;
  booking: PatientBookingRow | null;
  onClose: () => void;
}) {
  const bookingPatientId = open && booking?.patientId ? booking.patientId : null;
  const bookingReceiptCode = open && booking?.receiptCode ? booking.receiptCode : null;
  const { data: patient } = usePatientDetail(bookingPatientId);
  const updateBookingStatus = useUpdateBookingStatus();
  const updatePatient = useUpdatePatient();
  const [stage, setStage] = useState<OnlineBookingStage>("confirm");
  const [bookingStatus, setBookingStatus] = useState<PatientBookingRow["status"]>("pending");
  const [paymentStatus, setPaymentStatus] = useState<PatientBookingRow["paymentStatus"]>("pending_cashier");
  const [vitals, setVitals] = useState<OnlineBookingVitalsValues>(EMPTY_VITALS);
  const [result, setResult] = useState<OnlineBookingResult | null>(null);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const vitalsAlerts = useMemo(
    () => evaluateVitalsAlerts(vitals).filter((alert) => alert.level !== "normal"),
    [vitals],
  );
  const vitalsAlertsByKey = useMemo(() => {
    const alertMap = new Map<string, VitalAlert>();

    for (const alert of vitalsAlerts) {
      const existing = alertMap.get(alert.key);
      if (!existing || (alert.level === "critical" && existing.level !== "critical")) {
        alertMap.set(alert.key, alert);
      }
    }

    return alertMap;
  }, [vitalsAlerts]);
  const highestAlertLevel = vitalsAlerts.some((alert) => alert.level === "critical")
    ? "critical"
    : vitalsAlerts.length > 0
      ? "warning"
      : null;

  useEffect(() => {
    if (!open || !booking) {
      return;
    }

    setStage("confirm");
    setBookingStatus(booking.status);
    setPaymentStatus(booking.paymentStatus);
    setVitals(buildVitalsSeed(patient));
    setResult(null);
    setError("");
  }, [booking, open, patient]);

  useEffect(() => {
    if (open && patient) {
      setVitals(buildVitalsSeed(patient));
    }
  }, [open, patient]);

  if (!open || !booking) {
    return null;
  }

  if (!bookingPatientId || !bookingReceiptCode) {
    return (
      <div
        aria-modal="true"
        className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4"
        role="dialog"
      >
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl">
          <p className="text-sm font-semibold text-rose-700">
            Booking data is incomplete.
          </p>
          <div className="mt-4 flex justify-end">
            <Button onClick={onClose} type="button" variant="tertiary">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const patientName = booking.patientFullName || "Unknown patient";
  const serviceLabel = booking.serviceName || "Online booking";
  const vitalsSeeded = hasVitals(vitals);
  const stepIndex = stage === "confirm" ? 0 : stage === "vitals" ? 1 : stage === "billing" ? 2 : 3;

  const handleConfirmBooking = async () => {
    setError("");

    if (bookingStatus === "confirmed") {
      setStage("vitals");
      return;
    }

    try {
      setIsBusy(true);
      await updateBookingStatus.mutateAsync({
        bookingId: booking.id,
        status: "confirmed",
      });
      setBookingStatus("confirmed");
      toast.success("Booking confirmed.");
      setStage("vitals");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to confirm booking.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveVitals = async () => {
    setError("");

    if (!patient) {
      setError("Patient record is still loading.");
      return;
    }

    try {
      setIsBusy(true);
      const { id, createdAt, updatedAt, ...basePatient } = patient;
      void id;
      void createdAt;
      void updatedAt;
      await updatePatient.mutateAsync({
        patientId: patient.id,
        payload: {
          ...basePatient,
          temperature: vitals.temperature.trim() || undefined,
          bloodPressure: vitals.bloodPressure.trim() || undefined,
          heartRate: vitals.heartRate.trim() || undefined,
          o2Sat: vitals.o2Sat.trim() || undefined,
          respiratoryRate: vitals.respiratoryRate.trim() || undefined,
          weight: vitals.weight.trim() || undefined,
          height: vitals.height.trim() || undefined,
          vitalsRecordedAt: vitalsSeeded ? new Date().toISOString() : patient.vitalsRecordedAt ?? null,
        },
      });
      toast.success("Vitals saved.");
      setStage("billing");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to save vitals.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateBillingAndSend = async () => {
    setError("");

    try {
      setIsBusy(true);
      const workflowResult = await markBookingPaidAndCreateInvoiceLiveOrDemo(bookingReceiptCode);
      const invoice = normalizeBookingInvoice(workflowResult.invoice as BookingInvoiceShape);
      const appointmentId = invoice.appointmentId;

      if (appointmentId) {
        await updateAppointmentStatusAndNotesLiveOrDemo({
          appointmentId,
          status: "in_progress",
          notes: booking.intakeNotes || "Online booking auto sent to doctor.",
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments }),
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices }),
        queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems }),
        queryClient.invalidateQueries({ queryKey: queryKeys.patients }),
        queryClient.invalidateQueries({ queryKey: queryKeys.patientBookings(booking.patientId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.patientDetail(booking.patientId) }),
      ]);

      setPaymentStatus("paid");
      setResult(invoice);
      setStage("complete");
      toast.success("Booking sent to the doctor.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to complete online booking.");
    } finally {
      setIsBusy(false);
    }
  };

  const confirmButtonLabel =
    bookingStatus === "confirmed" ? "Continue to vitals" : "Confirm booking";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="flex w-full max-w-3xl max-h-[88vh] flex-col overflow-hidden border border-blue-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-blue-50/85">
                Online bookings workflow
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Process booking
              </h2>
              <p className="mt-1 text-sm text-blue-50/90">
                Confirm the booking, capture vitals, auto-create billing, then hand off to the doctor.
              </p>
            </div>
            <button
              aria-label="Close online booking wizard"
              className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={onClose}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            {["Confirm", "Vitals", "Billing", "Done"].map((label, index) => (
              <div
                className={cn(
                  "h-1.5 rounded-full bg-white/25",
                  index <= stepIndex ? "bg-white" : "",
                )}
                key={label}
                title={label}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-blue-50/90">
            <span>Step {Math.min(stepIndex + 1, 4)} of 4</span>
            <span>{serviceLabel}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/80 px-6 py-5">
          {stage === "complete" ? (
            <div className="space-y-5 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-6">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-700">
                Workflow complete
              </p>
              <h3 className="text-2xl font-black tracking-tight text-slate-950">
                Sent to doctor
              </h3>
              <p className="max-w-2xl text-sm leading-relaxed text-emerald-900/80">
                The booking is confirmed, vitals are saved, billing is created, and the appointment is now in consultation.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-emerald-600">
                    Invoice
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-950">
                    {result?.invoiceNumber ?? "Created"}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-emerald-600">
                    Appointment
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-950">
                    {result?.appointmentId ?? "In progress"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="!bg-emerald-600 !text-white hover:!bg-emerald-700" onClick={onClose} type="button">
                  Close
                </Button>
                <Link
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  to={`/app/patients/${booking.patientId}`}
                >
                  Open patient chart
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              {stage === "confirm" ? (
                <div className="space-y-4 rounded-3xl border border-blue-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-600">
                        Confirm booking
                      </p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                        Lock in the online booking
                      </h3>
                    </div>
                    <StatusPill
                      className="bg-blue-50 text-blue-700 ring-blue-200"
                      status={bookingStatus}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                        Patient
                      </p>
                      <p className="mt-1 font-bold text-slate-950">{patientName}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                        Schedule
                      </p>
                      <p className="mt-1 font-bold text-slate-950">
                        {formatBookingDateTime(booking.preferredDate, booking.preferredTime)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                        Service
                      </p>
                      <p className="mt-1 font-bold text-slate-950">{serviceLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                        Fee
                      </p>
                      <p className="mt-1 font-bold text-slate-950">
                        {formatCurrency(booking.feeAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    This step marks the booking as confirmed before vitals and billing.
                  </div>
                </div>
              ) : null}

              {stage === "vitals" ? (
                <div className="space-y-4 rounded-3xl border border-blue-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-600">
                        Vitals
                      </p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                        Record patient vitals
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill
                        className="bg-blue-50 text-blue-700 ring-blue-200"
                        status={bookingStatus}
                      />
                      <BookingPaymentPill status={paymentStatus} />
                    </div>
                  </div>

                  {vitalsAlerts.length > 0 ? (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
                        getAlertSeverityClasses(highestAlertLevel ?? "warning").panel,
                      )}
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div className="space-y-2">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.24em]">
                          Vitals review needed
                        </p>
                        <p className="leading-relaxed">
                          Some readings need attention before this booking is sent to the doctor.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {vitalsAlerts.map((alert) => (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                                getAlertSeverityClasses(alert.level).badge,
                              )}
                              key={alert.key}
                            >
                              {alert.label}: {alert.status}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {!patient ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      Loading patient details...
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {([
                        ["temperature", "Temperature (C)", "e.g. 37.2"],
                        ["bloodPressure", "Blood pressure", "e.g. 120/80"],
                        ["heartRate", "Heart rate (bpm)", "e.g. 78"],
                        ["o2Sat", "O2 saturation (%)", "e.g. 98"],
                        ["respiratoryRate", "Respiratory rate", "e.g. 18"],
                        ["weight", "Weight (kg)", "e.g. 62"],
                        ["height", "Height (cm)", "e.g. 168"],
                      ] as const).map(([key, label, placeholder]) => (
                        <FormField key={key} label={label}>
                          {(() => {
                            const fieldAlert =
                              key === "weight" || key === "height"
                                ? vitalsAlertsByKey.get("bmi")
                                : vitalsAlertsByKey.get(key);
                            const alertClasses = fieldAlert
                              ? getAlertSeverityClasses(fieldAlert.level)
                              : null;

                            return (
                              <div className="space-y-1.5">
                                <Input
                                  className={cn(
                                    "focus:!border-blue-500 focus:!ring-blue-500/20",
                                    alertClasses?.ring,
                                  )}
                                  onChange={(event) =>
                                    setVitals((prev) => ({ ...prev, [key]: event.target.value }))
                                  }
                                  placeholder={placeholder}
                                  value={vitals[key]}
                                />
                                {fieldAlert ? (
                                  <p className={cn("text-[11px] font-semibold", alertClasses?.text)}>
                                    {fieldAlert.label}: {fieldAlert.status}
                                  </p>
                                ) : null}
                              </div>
                            );
                          })()}
                        </FormField>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {stage === "billing" ? (
                <div className="space-y-4 rounded-3xl border border-blue-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-600">
                        Billing
                      </p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                        Auto-fetched billing preview
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill
                        className="bg-blue-50 text-blue-700 ring-blue-200"
                        status={bookingStatus}
                      />
                      <BookingPaymentPill status={paymentStatus} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                        Invoice item
                      </p>
                      <p className="mt-1 font-bold text-slate-950">{getBookingFeeLabel(booking)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                        Charge
                      </p>
                      <p className="mt-1 font-bold text-slate-950">{formatCurrency(booking.feeAmount)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                        Receipt code
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold text-slate-950">
                        {booking.receiptCode}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                        Doctor
                      </p>
                      <p className="mt-1 font-bold text-slate-950">
                        {booking.doctorFullName || "Clinic doctor"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    Billing will be created automatically, marked paid, and the booking will be handed to consultation.
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {stage !== "complete" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <div className="text-xs text-slate-500">
              {bookingStatus === "confirmed" ? "Booking already confirmed" : "Confirm first, then vitals, then billing."}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isBusy || stage === "confirm"}
                onClick={() => {
                  if (stage === "vitals") {
                    setStage("confirm");
                  } else if (stage === "billing") {
                    setStage("vitals");
                  }
                }}
                type="button"
                variant="tertiary"
              >
                Back
              </Button>
              <Button
                className="!bg-blue-600 !text-white hover:!bg-blue-700"
                disabled={isBusy}
                onClick={() => {
                  if (stage === "confirm") {
                    void handleConfirmBooking();
                  } else if (stage === "vitals") {
                    void handleSaveVitals();
                  } else if (stage === "billing") {
                    void handleCreateBillingAndSend();
                  }
                }}
                type="button"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : stage === "confirm" ? (
                  confirmButtonLabel
                ) : stage === "vitals" ? (
                  <>
                    <Stethoscope className="size-4" />
                    Save vitals
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Create billing & send
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
