import { AlertTriangle, CalendarDays, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';

import { Button } from '../../../components/ui/button';
import { getDatabase, listLabOrders, updateLabOrderSchedule } from '../../../lib/local-db';
import { printHtmlDocument } from '../../../lib/print';
import { queryKeys } from '../../../lib/query-keys';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../auth/auth-context';
import { useClinicLabQueue, useConfirmLabRequestByFrontDesk, useUpdateLabRequestDetails } from '../../lab-requests/hooks/use-lab-requests';
import { buildLabServiceReceiptLookupUrl } from '../lab-service-receipt';
import { toLabRequestDisplayStatus } from './lab-request-status';
import { LabStatusPill } from './lab-status-pill';

const LAB_REQUEST_SCHEDULES_KEY = 'odc.lab-request-schedules.v1';

interface ClinicListRow {
  id: string;
  name: string;
}

interface ScheduleEntry {
  date: string;
  time: string;
}

interface ScheduleOrderItem {
  id: string;
  patientLabel: string;
  serviceLabel: string;
  status: string;
  paymentStatus: string;
  receiptCode: string | null;
  urgentFlag: boolean;
  schedDate: string | null;
  schedTime: string | null;
}

interface ScheduleReceiptState {
  requestId: string;
  patientLabel: string;
  serviceLabel: string;
  status: string;
  paymentStatus: string;
  receiptCode: string | null;
  scheduledDate: string;
  scheduledTime: string;
}

function buildScheduleReceiptPrintDocument(input: {
  qrSvgMarkup: string;
  receipt: ScheduleReceiptState;
}) {
  const printedAt = new Date();
  const paymentLabel = input.receipt.paymentStatus === 'paid' ? 'PAID' : 'PENDING';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Laboratory Schedule Receipt</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 28px;
        background: #f8fafc;
        color: #1f2937;
      }
      .sheet {
        max-width: 760px;
        margin: 0 auto;
        background: #ffffff;
        padding: 30px 44px 34px;
      }
      .clinic-name {
        margin: 0;
        color: #2563eb;
        font-size: 20px;
        font-weight: 700;
        text-align: center;
      }
      h1 {
        margin: 8px 0 0;
        font-size: 17px;
        font-weight: 800;
        text-align: center;
        text-transform: uppercase;
      }
      .divider {
        margin: 22px 0 30px;
        border: 0;
        border-top: 2px solid #374151;
      }
      .meta {
        display: grid;
        grid-template-columns: 190px minmax(0, 1fr);
        row-gap: 8px;
        column-gap: 16px;
      }
      .meta-label {
        font-size: 14px;
        font-weight: 700;
        color: #374151;
      }
      .meta-value {
        font-size: 14px;
        color: #111827;
        text-align: right;
        word-break: break-word;
      }
      .code {
        font-family: "Courier New", monospace;
      }
      .status {
        font-weight: 800;
        color: ${input.receipt.paymentStatus === 'paid' ? '#059669' : '#b45309'};
      }
      .qr-panel {
        margin-top: 26px;
        border: 1px dashed #d1d5db;
        border-radius: 10px;
        padding: 18px 18px 14px;
        text-align: center;
      }
      .qr-wrap {
        margin-top: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 158px;
      }
      .qr-wrap svg {
        width: 150px;
        height: 150px;
      }
      .instructions {
        margin-top: 22px;
        border-left: 4px solid #f59e0b;
        padding-left: 12px;
      }
      .instructions-title {
        font-size: 14px;
        font-weight: 800;
        color: #1f2937;
      }
      .instructions ul {
        margin: 10px 0 0 18px;
        padding: 0;
        color: #1f2937;
        font-size: 14px;
      }
      .instructions li + li {
        margin-top: 6px;
      }
      @media print {
        body {
          background: #ffffff;
          padding: 0;
        }
        .sheet {
          border: none;
          border-radius: 0;
          max-width: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <p class="clinic-name">Odyssey Clinic</p>
      <h1>Laboratory Schedule Receipt</h1>
      <hr class="divider" />

      <section class="meta">
        <p class="meta-label">Patient:</p>
        <p class="meta-value">${input.receipt.patientLabel}</p>

        <p class="meta-label">Laboratory service:</p>
        <p class="meta-value">${input.receipt.serviceLabel}</p>

        <p class="meta-label">Schedule date:</p>
        <p class="meta-value">${input.receipt.scheduledDate}</p>

        <p class="meta-label">Schedule time:</p>
        <p class="meta-value">${input.receipt.scheduledTime}</p>

        <p class="meta-label">Request ID:</p>
        <p class="meta-value code">${input.receipt.requestId}</p>

        <p class="meta-label">Receipt code:</p>
        <p class="meta-value code">${input.receipt.receiptCode ?? 'N/A'}</p>

        <p class="meta-label">Payment status:</p>
        <p class="meta-value status">${paymentLabel}</p>

        <p class="meta-label">Printed at:</p>
        <p class="meta-value">${printedAt.toLocaleString('en-PH')}</p>
      </section>

      <section class="qr-panel">
        <p><strong>Laboratory Receipt QR</strong></p>
        <div class="qr-wrap">${input.qrSvgMarkup}</div>
        <p>Scan this code in Billing or Laboratory scan page to load this request.</p>
      </section>

      <section class="instructions">
        <p class="instructions-title">Instructions</p>
        <ul>
          <li>Proceed to Billing for payment confirmation if payment is still pending.</li>
          <li>Keep this receipt and present the QR code to clinic staff.</li>
          <li>After payment, laboratory can continue processing this request.</li>
        </ul>
      </section>
    </main>
  </body>
</html>`;
}

function loadSupabaseSchedules(): Record<string, ScheduleEntry> {
  if (typeof window === 'undefined') {
    return {};
  }

  const raw = window.localStorage.getItem(LAB_REQUEST_SCHEDULES_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, ScheduleEntry>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function saveSupabaseSchedules(entries: Record<string, ScheduleEntry>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LAB_REQUEST_SCHEDULES_KEY, JSON.stringify(entries));
}

function generateCalendarDays(): Date[] {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push(d);
  }
  return days;
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 16; h++) {
    for (let m = 0; m < 60; m += 10) {
      if (h === 16 && m > 50) break;
      const period = h < 12 ? 'AM' : 'PM';
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      slots.push(`${displayH}:${m.toString().padStart(2, '0')} ${period}`);
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

export function ScheduleTab() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'patient';
  const database = getDatabase();
  const qc = useQueryClient();

  const { data: localOrders = [] } = useQuery({
    queryKey: queryKeys.laboratory,
    queryFn: async () => listLabOrders(),
    enabled: !isSupabaseConfigured,
  });

  const { data: availableClinics = [] } = useQuery({
    queryKey: ['lab-form-clinics'],
    queryFn: async () => {
      if (!supabase) {
        return [] as ClinicListRow[];
      }

      const { data, error } = await supabase.from('clinics').select('id, name').order('name', { ascending: true });
      if (error) {
        throw error;
      }

      return (data ?? []) as ClinicListRow[];
    },
    enabled: Boolean(isSupabaseConfigured),
  });

  const resolvedClinicId = availableClinics[0]?.id ?? null;
  const { data: liveOrders = [] } = useClinicLabQueue(isSupabaseConfigured ? resolvedClinicId : null);
  const confirmByFrontDeskMutation = useConfirmLabRequestByFrontDesk();
  const updateLiveRequestMutation = useUpdateLabRequestDetails();
  const [supabaseSchedules, setSupabaseSchedules] = useState<Record<string, ScheduleEntry>>(() => loadSupabaseSchedules());

  const orders = useMemo<ScheduleOrderItem[]>(() => {
    if (isSupabaseConfigured) {
      return liveOrders.map((order) => {
        const persisted = supabaseSchedules[order.id];
        return {
          id: order.id,
          patientLabel: order.patientName ?? 'Unknown patient',
          serviceLabel: order.serviceName ?? order.serviceCategory,
          status: toLabRequestDisplayStatus(order.status, Boolean(persisted)),
          paymentStatus: order.paymentStatus,
          receiptCode: order.receiptCode,
          urgentFlag: order.urgentFlag,
          schedDate: persisted?.date ?? null,
          schedTime: persisted?.time ?? null,
        };
      });
    }

    return localOrders.map((order) => {
      const patient = database.patients.find((item) => item.id === order.patientId);
      const service = database.labServices.find((item) => item.id === order.labServiceId);
      return {
        id: order.id,
        patientLabel: [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || order.patientId,
        serviceLabel: service?.name ?? order.labServiceId,
        status: toLabRequestDisplayStatus(order.status, Boolean(order.schedDate && order.schedTime)),
        paymentStatus: 'pending_cashier',
        receiptCode: null,
        urgentFlag: Boolean(order.urgentFlag),
        schedDate: order.schedDate ?? null,
        schedTime: order.schedTime ?? null,
      };
    });
  }, [database.labServices, database.patients, liveOrders, localOrders, supabaseSchedules]);

  const unscheduled = useMemo(() => orders.filter((o) => !o.schedDate), [orders]);
  const scheduledOrders = useMemo(
    () =>
      orders
        .filter((o) => o.schedDate && o.schedTime)
        .sort((left, right) => (right.schedDate ?? '').localeCompare(left.schedDate ?? '')),
    [orders],
  );

  const existingSchedules = useMemo(
    () => orders.filter((o) => o.schedDate && o.schedTime).map((o) => ({ date: o.schedDate!, time: o.schedTime! })),
    [orders],
  );

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [scheduleReceipt, setScheduleReceipt] = useState<ScheduleReceiptState | null>(null);
  const [scheduleReceiptQrSvg, setScheduleReceiptQrSvg] = useState('');
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);

  const calendarDays = useMemo(() => generateCalendarDays(), []);

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  function isDateDisabled(d: Date): boolean {
    const cmp = new Date(d);
    cmp.setHours(0, 0, 0, 0);
    return cmp < todayMidnight;
  }

  function isTimeDisabled(time: string): boolean {
    if (!selectedDate) return false;
    const selD = new Date(selectedDate);
    selD.setHours(0, 0, 0, 0);
    const now = new Date();
    const nowMidnight = new Date(now);
    nowMidnight.setHours(0, 0, 0, 0);
    if (selD > nowMidnight) return false;
    const [timePart, period] = time.split(' ');
    const [h, m] = timePart.split(':').map(Number);
    let hour = h;
    if (period === 'PM' && h !== 12) hour += 12;
    if (period === 'AM' && h === 12) hour = 0;
    return hour < now.getHours() || (hour === now.getHours() && m <= now.getMinutes());
  }

  function isSlotConflicted(time: string): boolean {
    return existingSchedules.some((s) => s.date === selectedDate && s.time === time);
  }

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return unscheduled.filter((o) => {
      return (
        !q ||
        o.patientLabel.toLowerCase().includes(q) ||
        o.serviceLabel.toLowerCase().includes(q)
      );
    });
  }, [search, unscheduled]);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const HISTORY_PAGE_SIZE = 8;
  const historyTotalPages = Math.max(1, Math.ceil(scheduledOrders.length / HISTORY_PAGE_SIZE));
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return scheduledOrders.slice(start, start + HISTORY_PAGE_SIZE);
  }, [historyPage, scheduledOrders]);

  useEffect(() => {
    setHistoryPage(1);
  }, [scheduledOrders.length]);

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    }
  }, [historyPage, historyTotalPages]);

  useEffect(() => {
    if (!scheduleReceipt) {
      setScheduleReceiptQrSvg('');
      return;
    }

    let active = true;
    void QRCode.toString(buildLabServiceReceiptLookupUrl(scheduleReceipt.requestId), {
      errorCorrectionLevel: 'M',
      margin: 1,
      type: 'svg',
      width: 220,
    }).then((svg) => {
      if (active) {
        setScheduleReceiptQrSvg(svg);
      }
    }).catch(() => {
      if (active) {
        setScheduleReceiptQrSvg('');
      }
    });

    return () => {
      active = false;
    };
  }, [scheduleReceipt]);

  const closeScheduleReceiptModal = () => {
    setScheduleReceipt(null);
    setScheduleReceiptQrSvg('');
    setIsPrintingReceipt(false);
  };

  const handlePrintScheduleReceipt = async () => {
    if (!scheduleReceipt || !scheduleReceiptQrSvg) {
      return;
    }

    setIsPrintingReceipt(true);
    try {
      await printHtmlDocument(buildScheduleReceiptPrintDocument({
        qrSvgMarkup: scheduleReceiptQrSvg,
        receipt: scheduleReceipt,
      }));
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId || !selectedDate || !selectedTime) throw new Error('All fields required');
      if (isSlotConflicted(selectedTime)) throw new Error('This slot is already taken. Choose another time.');

      if (isSupabaseConfigured) {
        return { mode: 'supabase' as const, id: selectedOrderId, date: selectedDate, time: selectedTime };
      }

      await updateLabOrderSchedule(selectedOrderId, selectedDate, selectedTime);
      return { mode: 'local' as const, id: selectedOrderId, date: selectedDate, time: selectedTime };
    },
    onSuccess: async (result) => {
      if (result.mode === 'supabase') {
        setSupabaseSchedules((current) => {
          const next = {
            ...current,
            [result.id]: { date: result.date, time: result.time },
          };
          saveSupabaseSchedules(next);
          return next;
        });

        const scheduledRequest = liveOrders.find((order) => order.id === result.id);
        if (scheduledRequest?.status === 'pending') {
          try {
            if (role === 'front_desk_cashier') {
              await confirmByFrontDeskMutation.mutateAsync(result.id);
            } else {
              await updateLiveRequestMutation.mutateAsync({
                requestId: result.id,
                status: 'in_progress',
                patientNotes: scheduledRequest.patientNotes,
                urgentFlag: scheduledRequest.urgentFlag,
              });
            }
          } catch {
            // Scheduling should still succeed even if status sync is blocked by row-level policies.
            setError('Schedule saved, but status sync is restricted for this account. It may still appear as pending in other screens.');
          }
        }
      } else {
        void qc.invalidateQueries({ queryKey: queryKeys.laboratory });
      }

      const receiptOrder = orders.find((order) => order.id === result.id);
      if (role === 'front_desk_cashier' && receiptOrder) {
        setScheduleReceipt({
          requestId: receiptOrder.id,
          patientLabel: receiptOrder.patientLabel,
          serviceLabel: receiptOrder.serviceLabel,
          status: receiptOrder.status,
          paymentStatus: receiptOrder.paymentStatus,
          receiptCode: receiptOrder.receiptCode,
          scheduledDate: result.date,
          scheduledTime: result.time,
        });
      }

      setSelectedOrderId('');
      setSelectedDate('');
      setSelectedTime('');
      setError('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (e: Error) => setError(e.message),
  });

  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="shrink-0 bg-violet-700 p-2.5 text-white">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700">Laboratory Workflow</p>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-950">Schedule</h2>
              <p className="mt-1 text-sm text-slate-500">Assign dates and time slots for pending laboratory requests.</p>
            </div>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Search patient or test..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
          <span className="text-xs font-bold text-slate-500">{unscheduled.length} pending scheduling</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
          <div className="p-2 bg-violet-700 text-white shrink-0">
            <CalendarDays className="size-4" />
          </div>
          <div>
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Unscheduled Lab Tests</p>
            <p className="text-[11px] text-slate-400 font-medium">{unscheduled.length} pending scheduling</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredOrders.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              {unscheduled.length === 0 ? 'All lab tests have been scheduled.' : 'No results match your search.'}
            </div>
          ) : (
            paginatedOrders.map((order) => {
              return (
                <button
                  key={order.id}
                  className={cn(
                    'w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors',
                    selectedOrderId === order.id && 'bg-violet-50 border-l-4 border-violet-600',
                  )}
                  onClick={() => { setSelectedOrderId(order.id); setError(''); }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-slate-950">{order.serviceLabel}</p>
                        {order.urgentFlag && <AlertTriangle className="size-3.5 text-rose-500" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{order.patientLabel}</p>
                    </div>
                    <LabStatusPill status={order.status} />
                  </div>
                </button>
              );
            })
          )}
        </div>
        {filteredOrders.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-600">Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-violet-700 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-violet-200">Assign Schedule</p>
          <p className="text-sm font-bold text-white mt-0.5">Pick date and time slot</p>
        </div>

        {!selectedOrderId ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            Select a lab order on the left to assign a schedule.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            <div className="px-6 py-5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Select Date</p>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 py-1">{d}</div>
                ))}
                {calendarDays.map((d) => {
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const disabled = isDateDisabled(d);
                  const isSelected = selectedDate === key;
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      className={cn(
                        'p-1.5 text-xs font-medium transition-colors',
                        disabled ? 'text-slate-200 cursor-not-allowed' : 'hover:bg-violet-50 cursor-pointer',
                        isToday && !isSelected && 'text-violet-600 font-extrabold',
                        isSelected && 'bg-violet-700 text-white font-extrabold',
                      )}
                      onClick={() => { setSelectedDate(key); setSelectedTime(''); setError(''); }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="px-6 py-5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Select Time Slot</p>
                <div className="grid grid-cols-4 gap-1 max-h-52 overflow-y-auto pr-1">
                  {TIME_SLOTS.map((slot) => {
                    const disabled = isTimeDisabled(slot);
                    const conflicted = isSlotConflicted(slot);
                    const isSelected = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={disabled || conflicted}
                        className={cn(
                          'text-[10px] font-bold px-1 py-1.5 transition-colors border',
                          disabled || conflicted
                            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                            : 'border-slate-200 hover:border-violet-400 hover:bg-violet-50 cursor-pointer',
                          isSelected && 'border-violet-600 bg-violet-700 text-white',
                          conflicted && !disabled && 'bg-rose-50 border-rose-200 text-rose-300',
                        )}
                        onClick={() => { setSelectedTime(slot); setError(''); }}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  <span className="inline-block w-3 h-3 bg-rose-50 border border-rose-200 align-middle mr-1" /> = Slot taken
                </p>
              </div>
            )}

            {error && (
              <div className="px-6 py-3 bg-rose-50">
                <p className="text-xs text-rose-600 font-medium">{error}</p>
              </div>
            )}
            {success && (
              <div className="px-6 py-3 bg-emerald-50">
                <p className="text-xs text-emerald-600 font-medium">Schedule assigned successfully.</p>
              </div>
            )}

            <div className="px-6 py-4 bg-slate-50 space-y-3">
              {selectedDate && selectedTime && (
                <p className="text-xs text-slate-600 font-medium">
                  Scheduling for <span className="font-bold text-slate-950">{selectedDate}</span> at <span className="font-bold text-slate-950">{selectedTime}</span>
                </p>
              )}
              <Button
                className="w-full rounded-none bg-violet-700 hover:bg-violet-800 font-extrabold uppercase tracking-widest text-sm py-5"
                disabled={!selectedOrderId || !selectedDate || !selectedTime || scheduleMutation.isPending}
                type="button"
                onClick={() => void scheduleMutation.mutate()}
              >
                {scheduleMutation.isPending ? 'Saving…' : 'Confirm Schedule'}
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <div>
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Confirmed / Scheduled Bookings</p>
            <p className="text-[11px] text-slate-400 mt-0.5">History of laboratory bookings with assigned date and time</p>
          </div>
          <span className="text-xs font-bold text-slate-500">{scheduledOrders.length} booking{scheduledOrders.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Patient</th>
                <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Service</th>
                <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Date</th>
                <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Time</th>
                <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Status</th>
                {role === 'front_desk_cashier' ? (
                  <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Receipt</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedHistory.length === 0 ? (
                <tr>
                  <td className="px-6 py-12 text-center text-sm text-slate-400" colSpan={role === 'front_desk_cashier' ? 6 : 5}>
                    No scheduled laboratory bookings yet.
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm text-slate-700">{order.patientLabel}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-900">{order.serviceLabel}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{order.schedDate}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{order.schedTime}</td>
                    <td className="px-6 py-3"><LabStatusPill status={order.status} /></td>
                    {role === 'front_desk_cashier' ? (
                      <td className="px-6 py-3 text-right">
                        <button
                          type="button"
                          className="border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-700 transition hover:bg-slate-50"
                          onClick={() => setScheduleReceipt({
                            requestId: order.id,
                            patientLabel: order.patientLabel,
                            serviceLabel: order.serviceLabel,
                            status: order.status,
                            paymentStatus: order.paymentStatus,
                            receiptCode: order.receiptCode,
                            scheduledDate: order.schedDate ?? '',
                            scheduledTime: order.schedTime ?? '',
                          })}
                        >
                          View receipt
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {scheduledOrders.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-500">
              Showing {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}-{Math.min(historyPage * HISTORY_PAGE_SIZE, scheduledOrders.length)} of {scheduledOrders.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                disabled={historyPage === 1}
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-600">Page {historyPage} of {historyTotalPages}</span>
              <button
                type="button"
                className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}
                disabled={historyPage >= historyTotalPages}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {scheduleReceipt ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          role="dialog"
          onClick={closeScheduleReceiptModal}
        >
          <div
            className="my-auto w-full max-w-2xl overflow-hidden border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-violet-700 px-6 py-4">
              <p className="text-xs font-extrabold uppercase tracking-widest text-violet-200">Laboratory Receipt</p>
              <p className="mt-0.5 text-sm font-bold text-white">Schedule confirmed. Provide this QR for billing and intake.</p>
            </div>

            <div className="grid gap-5 px-6 py-5 md:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Scan code</p>
                <div className="mt-3 flex justify-center rounded-xl bg-white p-3">
                  {scheduleReceiptQrSvg ? (
                    <div
                      aria-label={`Receipt QR for ${scheduleReceipt.serviceLabel}`}
                      className="size-[220px]"
                      dangerouslySetInnerHTML={{ __html: scheduleReceiptQrSvg }}
                    />
                  ) : (
                    <div className="flex size-[220px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
                      Generating QR...
                    </div>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-500">Billing and laboratory can scan this code to open the linked request.</p>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Receipt details</p>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Patient</p>
                  <p className="mt-1 font-semibold text-slate-950">{scheduleReceipt.patientLabel}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Service</p>
                  <p className="mt-1 font-semibold text-slate-950">{scheduleReceipt.serviceLabel}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Date</p>
                    <p className="mt-1 font-semibold text-slate-950">{scheduleReceipt.scheduledDate}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Time</p>
                    <p className="mt-1 font-semibold text-slate-950">{scheduleReceipt.scheduledTime}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Payment</p>
                    <p className="mt-1 font-semibold text-slate-950">{scheduleReceipt.paymentStatus === 'paid' ? 'Paid' : 'Pending'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Status</p>
                    <p className="mt-1"><LabStatusPill status={scheduleReceipt.status} /></p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Request ID</p>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-950">{scheduleReceipt.requestId}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Receipt code</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-slate-950">{scheduleReceipt.receiptCode ?? 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Link
                className="inline-flex items-center justify-center border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-slate-700 transition hover:bg-slate-50"
                to="/app/billing"
              >
                Proceed to billing
              </Link>
              <Button
                className="rounded-none bg-violet-700 px-4 py-2 text-xs font-extrabold uppercase tracking-widest hover:bg-violet-800"
                type="button"
                onClick={() => void handlePrintScheduleReceipt()}
                disabled={!scheduleReceiptQrSvg || isPrintingReceipt}
              >
                {isPrintingReceipt ? 'Opening print preview...' : 'Print receipt'}
              </Button>
              <Button
                className="rounded-none"
                variant="secondary"
                type="button"
                onClick={closeScheduleReceiptModal}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
