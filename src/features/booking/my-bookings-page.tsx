import { useState } from "react";
import {
  CalendarClock,
  CheckCircle,
  ChevronDown,
  Clock4,
  Plus,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "../../components/ui/badge";
import { Card, CardTitle } from "../../components/ui/card";
import {
  formatCurrency,
  formatDateTimeLabel,
  formatDateLabel,
  formatTimeLabel,
} from "../../lib/utils";
import { useAuth } from "../auth/auth-context";
import { useMyTeleconsultAppointments } from "../teleconsult/hooks/use-teleconsult";
import { isTeleconsultJoinableStatus } from "../teleconsult/teleconsult-data";
import { BookingReceiptCard } from "./components/booking-receipt-card";
import { useMyBookings } from "./hooks/use-bookings";

function formatFeeLabel(feeType: "consultation" | "follow_up" | "service_fee" | string | null | undefined) {
  if (feeType === "follow_up") return "Follow-up Fee";
  if (feeType === "consultation") return "Consultation Fee";
  return "Medical Service Fee";
}

export function MyBookingsPage() {
  const { profile, session } = useAuth();
  const { data: bookings = [] } = useMyBookings(
    session?.user.id ?? profile?.email ?? null,
  );
  const { data: teleconsultAppointments = [] } = useMyTeleconsultAppointments();
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null);
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);

  const activeBookings = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "completed",
  );
  const pastBookings = bookings.filter(
    (b) => b.status === "cancelled" || b.status === "completed",
  );

  const getStatusColor = (_status: string) => "bg-white";

  const getStatusIcon = (status: string, size = "size-5") => {
    if (status === "confirmed")
      return <CheckCircle className={`${size} text-emerald-600`} />;
    if (status === "cancelled")
      return <XCircle className={`${size} text-rose-600`} />;
    if (status === "completed")
      return <CheckCircle className={`${size} text-slate-400`} />;
    return <Clock4 className={`${size} text-orange-600`} />;
  };

  const getStatusBadgeIntent = (status: string) => {
    if (status === "confirmed") return "success" as const;
    if (status === "cancelled") return "danger" as const;
    if (status === "completed") return "neutral" as const;
    return "warning" as const;
  };

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 animate-slide-left">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950">
            My Consultations
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Track your appointment requests, receipt QR, and cashier payment
            status.
          </p>
        </div>
        <Link to="/portal/book">
          <button className="flex items-center gap-2 border border-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-orange-600 transition-colors hover:bg-orange-50">
            <Plus className="size-3.5" />
            New Booking
          </button>
        </Link>
      </div>

      {teleconsultAppointments.length > 0 ? (
        <Card className="mb-6">
          <CardTitle>My teleconsult rooms</CardTitle>
          <div className="mt-5 space-y-4">
            {teleconsultAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">
                      {appointment.serviceName}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatDateTimeLabel(appointment.scheduledAt)} with{" "}
                      {appointment.doctorName}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {appointment.teleconsultationAccessInstructions}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge intent="info">
                      {appointment.teleconsultationPlatform}
                    </Badge>
                    {isTeleconsultJoinableStatus(appointment.status) ? (
                      <Link
                        className="mt-3 inline-flex text-sm font-semibold text-[var(--color-primary)]"
                        to={appointment.joinPath}
                      >
                        Join teleconsult
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-16 text-center animate-fade-in">
          <div className="mb-5 flex h-16 w-16 items-center justify-center border border-orange-100 bg-orange-50">
            <CalendarClock className="size-8 text-orange-600" />
          </div>
          <h3 className="mb-2 text-base font-extrabold uppercase tracking-wide text-slate-950">
            No Bookings Yet
          </h3>
          <p className="mb-6 max-w-xs text-sm leading-relaxed text-slate-500">
            Sign into a patient account or submit your first booking request to
            get started.
          </p>
          <Link
            to="/portal/book"
            className="inline-flex items-center gap-2 bg-orange-600 px-6 py-3 text-xs font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-orange-700"
          >
            Book an Appointment <CalendarClock className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ── Active bookings: pending / confirmed / rescheduled ── */}
          {activeBookings.length > 0 && (
            <div className="space-y-4">
              {activeBookings.map((booking, index) => {
                const receiptOpen = openReceiptId === booking.id;
                return (
                  <div
                    key={booking.id}
                    className={`animate-fade-up border border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md ${getStatusColor(booking.status)}`}
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="shrink-0 border border-slate-100 bg-slate-50 p-2">
                          {getStatusIcon(booking.status)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-extrabold uppercase leading-tight tracking-tight text-slate-950">
                            {booking.serviceName}
                          </h3>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Stethoscope className="size-3 shrink-0 text-orange-600" />
                            {booking.doctorName ?? "Clinic medical service"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className="shrink-0 whitespace-nowrap rounded-full text-[10px] font-extrabold uppercase tracking-widest"
                        intent={getStatusBadgeIntent(booking.status)}
                      >
                        {booking.status}
                      </Badge>
                    </div>

                    {/* Detail strip – 4 cells in a row on desktop */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 px-5 py-4 lg:grid-cols-4">
                      <div>
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Schedule
                        </p>
                        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                          {formatDateLabel(booking.preferredDate)}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          {formatTimeLabel(
                            `${booking.preferredDate} ${booking.preferredTime}`,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Booking charge
                        </p>
                        <p className="text-sm font-bold text-slate-900">
                          {formatFeeLabel(booking.feeType)}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          {formatCurrency(booking.feeAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Receipt code
                        </p>
                        <p className="font-mono text-sm font-bold text-slate-900">
                          {booking.receiptCode}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {booking.paymentStatus === "paid"
                            ? "Paid at cashier"
                            : "Pending cashier payment"}
                        </p>
                      </div>
                      {booking.intakeNotes ? (
                        <div>
                          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                            Reason / Notes
                          </p>
                          <p className="line-clamp-2 border-l-2 border-slate-200 pl-2 text-xs italic leading-relaxed text-slate-600">
                            {booking.intakeNotes}
                          </p>
                        </div>
                      ) : (
                        <div className="hidden lg:block" />
                      )}
                    </div>

                    {/* Receipt toggle footer */}
                    <div className="border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenReceiptId(receiptOpen ? null : booking.id)
                        }
                        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-xs font-extrabold uppercase tracking-widest text-orange-600 transition-colors hover:bg-orange-50"
                        aria-expanded={receiptOpen}
                      >
                        <span>
                          {receiptOpen ? "Hide Receipt QR" : "Show Receipt QR & Download"}
                        </span>
                        <ChevronDown
                          className={`size-4 shrink-0 transition-transform duration-200 ${receiptOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {receiptOpen && (
                        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                          <BookingReceiptCard booking={booking} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Past bookings: completed / cancelled – compact accordion ── */}
          {pastBookings.length > 0 && (
            <div>
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                Completed &amp; Cancelled ({pastBookings.length})
              </p>
              <div className="divide-y divide-slate-100 border border-slate-200 bg-white shadow-sm">
                {pastBookings.map((booking) => {
                  const isOpen = expandedPastId === booking.id;
                  const receiptOpen = openReceiptId === booking.id;
                  return (
                    <div key={booking.id}>
                      {/* Accordion trigger row */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPastId(isOpen ? null : booking.id)
                        }
                        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                        aria-expanded={isOpen}
                      >
                        <span className="shrink-0">
                          {getStatusIcon(booking.status, "size-4")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">
                            {booking.serviceName}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {booking.doctorName ?? "Clinic medical service"}
                            {" · "}
                            {formatDateLabel(booking.preferredDate)}
                          </span>
                        </div>
                        <Badge
                          className="shrink-0 text-[10px] font-extrabold uppercase tracking-widest"
                          intent={getStatusBadgeIntent(booking.status)}
                        >
                          {booking.status}
                        </Badge>
                        <span className="hidden shrink-0 text-xs font-semibold text-slate-500 sm:block">
                          {formatCurrency(booking.feeAmount)}
                        </span>
                        <ChevronDown
                          className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {/* Expanded detail panel */}
                      {isOpen && (
                        <div className={`border-t border-slate-100 ${getStatusColor(booking.status)}`}>
                          {/* 4-col detail strip */}
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 lg:grid-cols-4">
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Schedule
                              </p>
                              <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                                      {formatDateLabel(booking.preferredDate)}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                {formatTimeLabel(
                                  `${booking.preferredDate} ${booking.preferredTime}`,
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Booking charge
                              </p>
                              <p className="text-sm font-bold text-slate-900">
                                {formatFeeLabel(booking.feeType)}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                {formatCurrency(booking.feeAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Receipt code
                              </p>
                              <p className="font-mono text-sm font-bold text-slate-900">
                                {booking.receiptCode}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {booking.paymentStatus === "paid"
                                  ? "Paid at cashier"
                                  : "Pending cashier payment"}
                              </p>
                            </div>
                            {booking.intakeNotes ? (
                              <div>
                                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                  Reason / Notes
                                </p>
                                <p className="line-clamp-2 border-l-2 border-slate-200 pl-2 text-xs italic leading-relaxed text-slate-600">
                                  {booking.intakeNotes}
                                </p>
                              </div>
                            ) : null}
                          </div>

                          {/* Receipt toggle */}
                          <div className="border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenReceiptId(receiptOpen ? null : booking.id)
                              }
                              className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-xs font-extrabold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50"
                              aria-expanded={receiptOpen}
                            >
                              <span>
                                {receiptOpen ? "Hide Receipt QR" : "Show Receipt QR & Download"}
                              </span>
                              <ChevronDown
                                className={`size-4 shrink-0 transition-transform duration-200 ${receiptOpen ? "rotate-180" : ""}`}
                              />
                            </button>
                            {receiptOpen && (
                              <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                                <BookingReceiptCard booking={booking} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
