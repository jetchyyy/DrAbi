import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { useDoctorAvailability } from '../../hooks/use-clinic-data';
import {
  buildDailyTimeSlots,
  DOCTOR_AVAILABILITY_DAY_OPTIONS,
  DOCTOR_SLOT_MINUTE_OPTIONS,
  formatTimeLabel,
  toAvailabilityRowInput,
} from '../../lib/doctor-availability';
import {
  getCurrentDoctor,
  getSpecialistAvailabilityByDoctorIdLiveOrDemo,
  saveDoctorAvailabilityForProfileLiveOrDemo,
  saveDoctorFeeSettingsForProfileLiveOrDemo,
  saveSpecialistAvailabilityForProfileLiveOrDemo,
} from '../../lib/supabase-clinic';
import { queryKeys } from '../../lib/query-keys';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';

interface DayAvailabilityState {
  enabled: boolean;
  slotMinutes: number;
  selectedTimes: string[];
}

function createEmptyAvailabilityState(): Record<number, DayAvailabilityState> {
  return Object.fromEntries(
    DOCTOR_AVAILABILITY_DAY_OPTIONS.map((day) => [
      day.value,
      {
        enabled: false,
        slotMinutes: 30,
        selectedTimes: [],
      },
    ]),
  ) as Record<number, DayAvailabilityState>;
}

function buildAvailabilityState(
  availability: Array<{ dayOfWeek: number; startTime: string; slotMinutes: number }>,
): Record<number, DayAvailabilityState> {
  const next = createEmptyAvailabilityState();

  for (const slot of availability) {
    const day = next[slot.dayOfWeek];
    if (!day) {
      continue;
    }

    day.enabled = true;
    day.slotMinutes = slot.slotMinutes || day.slotMinutes;
    day.selectedTimes = [...day.selectedTimes, slot.startTime].sort();
  }

  return next;
}

function isSpecialistProfile(profile: {
  role?: string | null;
  accessRoleName?: string | null;
} | null) {
  if (!profile) {
    return false;
  }

  return (
    profile.role === 'specialist' ||
    profile.accessRoleName?.trim().toLowerCase() === 'specialist'
  );
}

export function DoctorAvailabilityPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const specialistMode = isSpecialistProfile(profile);
  const [days, setDays] = useState<Record<number, DayAvailabilityState>>(createEmptyAvailabilityState);
  const [consultationFee, setConsultationFee] = useState('0');
  const [followUpFee, setFollowUpFee] = useState('0');

  const doctorQuery = useQuery({
    queryKey: ['current-doctor', profile?.id],
    queryFn: () => getCurrentDoctor(profile?.id ?? ''),
    enabled: Boolean(profile?.id && (profile.role === 'doctor' || profile.role === 'specialist')),
  });

  const doctorAvailabilityQuery = useDoctorAvailability(
    !specialistMode ? (doctorQuery.data?.id ?? null) : null,
  );
  const specialistAvailabilityQuery = useQuery({
    queryKey: queryKeys.specialistAvailability(doctorQuery.data?.id ?? null),
    queryFn: () => getSpecialistAvailabilityByDoctorIdLiveOrDemo(doctorQuery.data?.id ?? null),
    enabled: Boolean(specialistMode && doctorQuery.data?.id),
  });
  const availabilityQuery =
    specialistMode ? specialistAvailabilityQuery : doctorAvailabilityQuery;

  useEffect(() => {
    if (!availabilityQuery.data) {
      return;
    }

    setDays(buildAvailabilityState(availabilityQuery.data));
  }, [availabilityQuery.data]);

  useEffect(() => {
    if (!doctorQuery.data) {
      return;
    }

    setConsultationFee(String(doctorQuery.data.consultationFee ?? 0));
    setFollowUpFee(String(doctorQuery.data.followUpFee ?? 0));
  }, [doctorQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) {
        throw new Error('Doctor profile not found.');
      }

      const payload = Object.entries(days).flatMap(([dayOfWeek, day]) => {
        if (!day.enabled) {
          return [];
        }

        return day.selectedTimes.map((startTime) =>
          toAvailabilityRowInput(
            doctorQuery.data?.id ?? profile.id,
            Number(dayOfWeek),
            startTime,
            day.slotMinutes,
          ),
        );
      });

      const savedAvailability =
        specialistMode
          ? await saveSpecialistAvailabilityForProfileLiveOrDemo(profile.id, payload)
          : await saveDoctorAvailabilityForProfileLiveOrDemo(profile.id, payload);
      await saveDoctorFeeSettingsForProfileLiveOrDemo(profile.id, {
        consultationFee: Number(consultationFee || 0),
        followUpFee: Number(followUpFee || 0),
      });

      return savedAvailability;
    },
    onSuccess: async (savedAvailability) => {
      setDays(buildAvailabilityState(savedAvailability));
      if (specialistMode) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.specialistAvailability(doctorQuery.data?.id ?? null),
        });
      } else {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.doctorAvailability(doctorQuery.data?.id ?? null),
        });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.doctors });
      toast.success('Availability saved.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to save availability.');
    },
  });

  const totalSelectedSlots = useMemo(
    () => Object.values(days).reduce((sum, day) => sum + day.selectedTimes.length, 0),
    [days],
  );

  if (profile?.role !== 'doctor' && profile?.role !== 'specialist') {
    return (
      <Card>
        <CardTitle>Provider availability</CardTitle>
        <p className="mt-3 text-sm text-slate-500">Only doctor and specialist accounts can manage their schedule here.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 via-white to-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge intent="info">{specialistMode ? 'Specialist portal' : 'Doctor portal'}</Badge>
            <CardTitle className="mt-4 text-2xl">Set your weekly availability</CardTitle>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">
              Choose which days you accept bookings or referred visits, then tick the exact time slots you want visible to the clinic team. Unchecked days stay unavailable.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-sm border border-orange-200 bg-white px-4 py-3">
            <CalendarCheck2 className="size-5 text-orange-600" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Selected slots</p>
              <p className="text-lg font-extrabold text-slate-950">{totalSelectedSlots}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Professional fees</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          These rates are shown during patient booking and saved into billing based on the fee selected for the booking.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-2 block">Consultation Fee</span>
            <Input min="0" step="0.01" type="number" value={consultationFee} onChange={(event) => setConsultationFee(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-2 block">Follow-up Fee</span>
            <Input min="0" step="0.01" type="number" value={followUpFee} onChange={(event) => setFollowUpFee(event.target.value)} />
          </label>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {DOCTOR_AVAILABILITY_DAY_OPTIONS.map((day) => {
          const state = days[day.value];
          const timeSlots = buildDailyTimeSlots(state.slotMinutes);

          return (
            <Card key={day.value} className={cn(!state.enabled && 'opacity-80')}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{day.label}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {state.enabled
                      ? `${state.selectedTimes.length} slot${state.selectedTimes.length === 1 ? '' : 's'} selected`
                      : 'Marked as unavailable'}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    checked={state.enabled}
                    className="size-4 accent-orange-600"
                    onChange={(event) =>
                      setDays((current) => ({
                        ...current,
                        [day.value]: {
                          ...current[day.value],
                          enabled: event.target.checked,
                          selectedTimes: event.target.checked ? current[day.value].selectedTimes : [],
                        },
                      }))
                    }
                    type="checkbox"
                  />
                  Available this day
                </label>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Time slot size</p>
                <Select
                  disabled={!state.enabled}
                  value={String(state.slotMinutes)}
                  onChange={(event) => {
                    const slotMinutes = Number(event.target.value);
                    const nextSlots = new Set(buildDailyTimeSlots(slotMinutes));
                    setDays((current) => ({
                      ...current,
                      [day.value]: {
                        ...current[day.value],
                        slotMinutes,
                        selectedTimes: current[day.value].selectedTimes.filter((time) => nextSlots.has(time)),
                      },
                    }));
                  }}
                >
                  {DOCTOR_SLOT_MINUTE_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-5">
                <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Available booking times</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {timeSlots.map((time) => {
                    const checked = state.selectedTimes.includes(time);
                    return (
                      <label
                        key={time}
                        className={cn(
                          'flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors',
                          state.enabled
                            ? checked
                              ? 'border-orange-300 bg-orange-50 text-orange-800'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-orange-200'
                            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
                        )}
                      >
                        <input
                          checked={checked}
                          className="size-4 accent-orange-600"
                          disabled={!state.enabled}
                          onChange={(event) =>
                            setDays((current) => {
                              const selectedTimes = event.target.checked
                                ? [...current[day.value].selectedTimes, time].sort()
                                : current[day.value].selectedTimes.filter((value) => value !== time);

                              return {
                                ...current,
                                [day.value]: {
                                  ...current[day.value],
                                  selectedTimes,
                                },
                              };
                            })
                          }
                          type="checkbox"
                        />
                        <span>{formatTimeLabel(time)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          className="min-w-44"
          disabled={saveMutation.isPending || doctorQuery.isLoading || availabilityQuery.isLoading}
          onClick={() => void saveMutation.mutateAsync()}
          type="button"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save availability'}
        </Button>
      </div>
    </div>
  );
}
