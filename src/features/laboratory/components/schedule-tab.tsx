import { AlertTriangle, CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { getDatabase, listLabOrders, updateLabOrderSchedule } from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import { cn } from '../../../lib/utils';
import { LabStatusPill } from './lab-status-pill';

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
  const database = getDatabase();
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({ queryKey: queryKeys.laboratory, queryFn: async () => listLabOrders() });

  const unscheduled = useMemo(() => orders.filter((o) => !o.schedDate), [orders]);

  const existingSchedules = useMemo(
    () => orders.filter((o) => o.schedDate && o.schedTime).map((o) => ({ date: o.schedDate!, time: o.schedTime! })),
    [orders],
  );

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
      const patient = database.patients.find((p) => p.id === o.patientId);
      const svc = database.labServices.find((s) => s.id === o.labServiceId);
      return (
        !q ||
        patient?.firstName?.toLowerCase().includes(q) ||
        patient?.lastName?.toLowerCase().includes(q) ||
        svc?.name?.toLowerCase().includes(q)
      );
    });
  }, [unscheduled, search, database]);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId || !selectedDate || !selectedTime) throw new Error('All fields required');
      if (isSlotConflicted(selectedTime)) throw new Error('This slot is already taken. Choose another time.');
      return updateLabOrderSchedule(selectedOrderId, selectedDate, selectedTime);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.laboratory });
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
        <div className="px-6 py-3 border-b border-slate-100">
          <Input placeholder="Search patient or test…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="divide-y divide-slate-100">
          {filteredOrders.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              {unscheduled.length === 0 ? 'All lab tests have been scheduled.' : 'No results match your search.'}
            </div>
          ) : (
            filteredOrders.map((order) => {
              const patient = database.patients.find((p) => p.id === order.patientId);
              const svc = database.labServices.find((s) => s.id === order.labServiceId);
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
                        <p className="font-bold text-sm text-slate-950">{svc?.name}</p>
                        {order.urgentFlag && <AlertTriangle className="size-3.5 text-rose-500" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{patient?.firstName} {patient?.lastName}</p>
                    </div>
                    <LabStatusPill status={order.status} />
                  </div>
                </button>
              );
            })
          )}
        </div>
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
  );
}
