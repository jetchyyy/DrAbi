import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import {
  listUsersLiveOrDemo,
  listAllConsultationsLiveOrDemo,
  listPatientsLiveOrDemo,
  settleConsultationsLiveOrDemo
} from '../../lib/supabase-clinic';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import {
  TrendingUp,
  Search,
  Users,
  CheckCircle2,
  Clock,
  ArrowLeft,
  DollarSign,
  Filter
} from 'lucide-react';
import type { UserProfile, Consultation } from '../../types/domain';

type DatePreset = 'all_time' | 'this_month' | 'last_30_days' | 'custom';

export function DoctorPayoutsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = profile?.role === 'owner_admin';
  const doctorProfileId = !isAdmin ? (profile?.id ?? null) : null;

  // Selected doctor ID for Admin drill-down view
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(doctorProfileId);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all_time');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Selected consultations for settlement action
  const [selectedConsultationIds, setSelectedConsultationIds] = useState<string[]>([]);

  // Fetching data
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users-list'],
    queryFn: listUsersLiveOrDemo,
  });

  const { data: consultations = [], isLoading: isLoadingConsultations } = useQuery({
    queryKey: ['all-consultations'],
    queryFn: listAllConsultationsLiveOrDemo,
  });

  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: listPatientsLiveOrDemo,
  });

  // Mutation for settling payouts
  const settleMutation = useMutation({
    mutationFn: settleConsultationsLiveOrDemo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-consultations'] });
      setSelectedConsultationIds([]);
    },
  });

  // Filter out doctors from users
  const doctors = useMemo(() => {
    return users.filter((u) => u.role === 'doctor' || u.role === 'specialist');
  }, [users]);

  const selectedDoctor = useMemo(() => {
    if (!selectedDoctorId) return null;
    return doctors.find((d) => d.id === selectedDoctorId || d.authUserId === selectedDoctorId) || null;
  }, [doctors, selectedDoctorId]);

  // Map patient names for quick lookup
  const patientMap = useMemo(() => {
    const map = new Map<string, string>();
    patients.forEach((p) => {
      const name = `${p.firstName} ${p.lastName}`.trim();
      map.set(p.id, name);
    });
    return map;
  }, [patients]);

  // Date boundary helper based on preset
  const dateBoundaries = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (datePreset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (datePreset === 'last_30_days') {
      start = new Date();
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end = now;
    } else if (datePreset === 'custom') {
      if (customStartDate) {
        start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
      }
      if (customEndDate) {
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
      }
    }

    return { start, end };
  }, [datePreset, customStartDate, customEndDate]);

  // Calculate payouts for a given consultation and doctor
  const getConsultationPayoutDetails = (c: Consultation, doc: UserProfile | undefined) => {
    if (!doc) return { fee: 0, share: 100, doctorPayout: 0, clinicCommission: 0 };
    const isFollowUp = c.consultationType.toLowerCase().includes('follow');
    const fee = isFollowUp ? (doc.followUpFee ?? 0) : (doc.consultationFee ?? 0);
    const share = doc.doctorSharePercentage ?? 100;
    const doctorPayout = (fee * share) / 100;
    const clinicCommission = fee - doctorPayout;
    return { fee, share, doctorPayout, clinicCommission };
  };

  // Process all consultation metrics
  const processedConsultations = useMemo(() => {
    return consultations.map((c) => {
      const doc = doctors.find((d) => d.id === c.doctorId || d.authUserId === c.doctorId);
      const patientName = patientMap.get(c.patientId) || c.providerName || 'Unknown Patient';
      const { fee, share, doctorPayout, clinicCommission } = getConsultationPayoutDetails(c, doc);

      return {
        ...c,
        doctorName: doc?.fullName || 'Unknown Doctor',
        patientName,
        fee,
        share,
        doctorPayout,
        clinicCommission,
        dateObj: new Date(c.consultationDate)
      };
    });
  }, [consultations, doctors, patientMap]);

  // Apply filters
  const filteredConsultations = useMemo(() => {
    return processedConsultations.filter((c) => {
      // Doctor filter
      if (selectedDoctorId && c.doctorId !== selectedDoctorId) return false;

      // Search query (doctor name, patient name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesDoctor = c.doctorName.toLowerCase().includes(query);
        const matchesPatient = c.patientName.toLowerCase().includes(query);
        if (!matchesDoctor && !matchesPatient) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && c.payoutStatus !== 'pending') return false;
        if (statusFilter === 'paid' && c.payoutStatus !== 'paid') return false;
      }

      // Date range filter
      const { start, end } = dateBoundaries;
      if (start && c.dateObj < start) return false;
      if (end && c.dateObj > end) return false;

      return true;
    });
  }, [processedConsultations, selectedDoctorId, searchQuery, statusFilter, dateBoundaries]);

  // Calculate high-level totals
  const metrics = useMemo(() => {
    let totalConsultationsCount = 0;
    let totalEntitledAmount = 0;
    let pendingPayoutAmount = 0;
    let settledPayoutAmount = 0;
    let clinicCommissionAmount = 0;

    // Filter consultations relevant to the current view (all or current doctor)
    const relevantConsultations = processedConsultations.filter((c) => {
      if (selectedDoctorId && c.doctorId !== selectedDoctorId) return false;
      // Filter by date range boundary
      const { start, end } = dateBoundaries;
      if (start && c.dateObj < start) return false;
      if (end && c.dateObj > end) return false;
      return true;
    });

    relevantConsultations.forEach((c) => {
      totalConsultationsCount++;
      totalEntitledAmount += c.doctorPayout;
      clinicCommissionAmount += c.clinicCommission;
      if (c.payoutStatus === 'paid') {
        settledPayoutAmount += c.doctorPayout;
      } else {
        pendingPayoutAmount += c.doctorPayout;
      }
    });

    const totalFeesCollected = totalEntitledAmount + clinicCommissionAmount;

    return {
      totalConsultationsCount,
      totalEntitledAmount,
      pendingPayoutAmount,
      settledPayoutAmount,
      clinicCommissionAmount,
      totalFeesCollected
    };
  }, [processedConsultations, selectedDoctorId, dateBoundaries]);

  // Doctor aggregation for Admin dashboard
  const doctorSummaries = useMemo(() => {
    if (!isAdmin) return [];

    const map = new Map<string, {
      doctor: UserProfile;
      consultationsCount: number;
      pendingAmount: number;
      paidAmount: number;
      totalPayout: number;
      clinicCommission: number;
    }>();

    doctors.forEach((doc) => {
      map.set(doc.id, {
        doctor: doc,
        consultationsCount: 0,
        pendingAmount: 0,
        paidAmount: 0,
        totalPayout: 0,
        clinicCommission: 0
      });
    });

    processedConsultations.forEach((c) => {
      const summary = map.get(c.doctorId);
      if (summary) {
        summary.consultationsCount++;
        summary.totalPayout += c.doctorPayout;
        summary.clinicCommission += c.clinicCommission;
        if (c.payoutStatus === 'paid') {
          summary.paidAmount += c.doctorPayout;
        } else {
          summary.pendingAmount += c.doctorPayout;
        }
      }
    });

    // Apply search filter to doctor list if query is entered
    let list = Array.from(map.values());
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.doctor.fullName.toLowerCase().includes(q));
    }

    return list;
  }, [doctors, processedConsultations, isAdmin, searchQuery]);

  const handleSettleSelected = () => {
    if (selectedConsultationIds.length === 0) return;
    if (window.confirm(`Are you sure you want to mark ${selectedConsultationIds.length} consultations as paid?`)) {
      settleMutation.mutate(selectedConsultationIds);
    }
  };

  const handleToggleSelectAll = () => {
    const selectable = filteredConsultations.filter(c => c.payoutStatus === 'pending');
    if (selectedConsultationIds.length === selectable.length) {
      setSelectedConsultationIds([]);
    } else {
      setSelectedConsultationIds(selectable.map(c => c.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedConsultationIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const isLoading = isLoadingUsers || isLoadingConsultations || isLoadingPatients;

  if (isLoading) {
    return (
      <div className="flex h-[450px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
          <p className="text-sm font-medium text-slate-500">Loading payout records...</p>
        </div>
      </div>
    );
  }

  // Render Drilldown or Doctor-Specific View
  if (selectedDoctorId && selectedDoctor) {
    const pendingConsultations = filteredConsultations.filter(c => c.payoutStatus === 'pending');

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => {
                  setSelectedDoctorId(null);
                  setSelectedConsultationIds([]);
                }}
                className="group inline-flex size-9 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition shadow-sm"
              >
                <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {selectedDoctor.fullName}
                </h1>
                <Badge intent="info">
                  {selectedDoctor.title || 'Doctor'}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {isAdmin ? 'Consultation payout rates and status summary' : 'Review your consultation earnings and payouts'}
              </p>
            </div>
          </div>

          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1">
            {(['all_time', 'this_month', 'last_30_days', 'custom'] as DatePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setDatePreset(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  datePreset === p
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range picker if custom preset selected */}
        {datePreset === 'custom' && (
          <Card className="bg-slate-50 border-dashed border-slate-200">
            <div className="pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">End Date</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="rounded-xl px-4 py-2"
                >
                  Clear Custom Range
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Metrics Grid */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="border-l-4 border-l-orange-500 shadow-sm">
            <div className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Consultations</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">{metrics.totalConsultationsCount}</p>
                  <p className="mt-1 text-xs text-slate-400">Total counted visits</p>
                </div>
                <div className="rounded-xl bg-orange-50 p-2 text-orange-600">
                  <Users className="size-6" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-slate-800 shadow-sm">
            <div className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Entitled Earnings</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">₱{metrics.totalEntitledAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="mt-1 text-xs text-slate-400">Rate Share: {selectedDoctor.doctorSharePercentage ?? 100}%</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2 text-slate-800">
                  <TrendingUp className="size-6" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <div className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Settled / Paid Payouts</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">₱{metrics.settledPayoutAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="mt-1 text-xs text-slate-400">Transferred to provider</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <CheckCircle2 className="size-6" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <div className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Payouts</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">₱{metrics.pendingPayoutAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="mt-1 text-xs text-slate-400">Awaiting clinic payout</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                  <Clock className="size-6" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters and List */}
        <Card className="shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-bold text-slate-900">Consultation Breakdowns</CardTitle>
                <Badge className="bg-slate-200 text-slate-800">
                  {filteredConsultations.length} records
                </Badge>
              </div>

              {/* Settle Action Bar (Admin only) */}
              {isAdmin && selectedConsultationIds.length > 0 && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                  <span className="text-xs font-semibold text-slate-600">
                    {selectedConsultationIds.length} selected
                  </span>
                  <Button
                    onClick={handleSettleSelected}
                    disabled={settleMutation.isPending}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 text-xs rounded-xl"
                  >
                    {settleMutation.isPending ? 'Settling...' : 'Mark as Paid / Settled'}
                  </Button>
                </div>
              )}
            </div>

            {/* Filter controls */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by patient name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="w-full sm:w-48">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full"
                >
                  <option value="all">All Payout Statuses</option>
                  <option value="pending">Pending Payout</option>
                  <option value="paid">Settled / Paid</option>
                </Select>
              </div>
            </div>
          </div>

          <div className="p-0">
            {filteredConsultations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="rounded-full bg-slate-100 p-3 text-slate-400">
                  <Filter className="size-6" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">No consultation records match</h3>
                <p className="mt-1 text-xs text-slate-500">Try adjusting your filters or date range.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <tr>
                      {isAdmin && (
                        <th className="p-4 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={
                              pendingConsultations.length > 0 &&
                              selectedConsultationIds.length === pendingConsultations.length
                            }
                            onChange={handleToggleSelectAll}
                            disabled={pendingConsultations.length === 0}
                            className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 size-4 cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="p-4">Patient Name</th>
                      <th className="p-4">Date & Time</th>
                      <th className="p-4">Service Type</th>
                      <th className="p-4 text-right">Consultation Fee</th>
                      <th className="p-4 text-center">Share %</th>
                      <th className="p-4 text-right">Entitled Share</th>
                      {isAdmin && <th className="p-4 text-right">Clinic Commission</th>}
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredConsultations.map((c) => {
                      const isPending = c.payoutStatus === 'pending';
                      const isSelected = selectedConsultationIds.includes(c.id);

                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-50/50 transition-colors ${
                            isSelected ? 'bg-orange-50/20' : ''
                          }`}
                        >
                          {isAdmin && (
                            <td className="p-4 text-center">
                              {isPending ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectOne(c.id)}
                                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 size-4 cursor-pointer"
                                />
                              ) : (
                                <div className="size-4 mx-auto bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                                  ✓
                                </div>
                              )}
                            </td>
                          )}
                          <td className="p-4 font-semibold text-slate-900">{c.patientName}</td>
                          <td className="p-4">
                            <div>{c.consultationDate}</div>
                            <div className="text-xs text-slate-400">{c.consultationTime}</div>
                          </td>
                          <td className="p-4">
                            <Badge className="capitalize bg-slate-100 text-slate-700">
                              {c.consultationType.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-4 text-right font-medium text-slate-900">
                            ₱{c.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-center font-medium text-slate-500">{c.share}%</td>
                          <td className="p-4 text-right font-bold text-slate-900">
                            ₱{c.doctorPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          {isAdmin && (
                            <td className="p-4 text-right font-semibold text-slate-500">
                              ₱{c.clinicCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          )}
                          <td className="p-4 text-center">
                            <Badge intent={c.payoutStatus === 'paid' ? 'success' : 'warning'}>
                              {c.payoutStatus === 'paid' ? 'Settled' : 'Pending Payout'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Render Admin main dashboard listing all doctors
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Doctor Payout Tracker</h1>
          <p className="text-sm text-slate-500">
            Monitor consultation volumes, check doctor share rates, and settle payouts.
          </p>
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1">
          {(['all_time', 'this_month', 'last_30_days', 'custom'] as DatePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setDatePreset(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                datePreset === p
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range picker if custom preset selected */}
      {datePreset === 'custom' && (
        <Card className="bg-slate-50 border-dashed border-slate-200">
          <div className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Start Date</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-semibold text-slate-500 mb-1">End Date</label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="rounded-xl px-4 py-2"
              >
                Clear Custom Range
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Global metrics grid */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <div className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Consultations</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-900">{metrics.totalConsultationsCount}</p>
                <p className="mt-1 text-xs text-slate-400">All registered appointments</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-2 text-orange-600">
                <Users className="size-6" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-slate-800 shadow-sm">
          <div className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Fees Collected</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-900">₱{metrics.totalFeesCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="mt-1 text-xs text-slate-400">Total gross intake</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2 text-slate-800">
                <DollarSign className="size-6" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <div className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Settled Doctor Payouts</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-900">₱{metrics.settledPayoutAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="mt-1 text-xs text-slate-400">Transferred to doctors</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                <CheckCircle2 className="size-6" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <div className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Doctor Payouts</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-900">₱{metrics.pendingPayoutAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="mt-1 text-xs text-slate-400">Outstanding clinic payout</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                <Clock className="size-6" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Doctors Table */}
      <Card className="shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-slate-900">Consultation Earnings by Doctor</CardTitle>
              <Badge className="bg-slate-200 text-slate-800">
                {doctorSummaries.length} providers
              </Badge>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search doctor by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="p-0">
          {doctorSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-full bg-slate-100 p-3 text-slate-400">
                <Users className="size-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">No doctors found</h3>
              <p className="mt-1 text-xs text-slate-500">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="p-4">Doctor Name</th>
                    <th className="p-4">Role / Title</th>
                    <th className="p-4 text-center">Consultations</th>
                    <th className="p-4 text-right">Consultation Fee</th>
                    <th className="p-4 text-center">Doctor Share %</th>
                    <th className="p-4 text-right text-amber-600">Pending Payout</th>
                    <th className="p-4 text-right text-emerald-600">Settled Payout</th>
                    <th className="p-4 text-right">Total Entitlement</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctorSummaries.map(({ doctor, consultationsCount, pendingAmount, paidAmount, totalPayout }) => (
                    <tr key={doctor.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-semibold text-slate-900">{doctor.fullName}</td>
                      <td className="p-4">
                        <Badge className="bg-slate-100 text-slate-800">
                          {doctor.title || 'Doctor'}
                        </Badge>
                      </td>
                      <td className="p-4 text-center font-semibold text-slate-900">{consultationsCount}</td>
                      <td className="p-4 text-right font-medium">
                        ₱{(doctor.consultationFee ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-500">{doctor.doctorSharePercentage ?? 100}%</td>
                      <td className="p-4 text-right font-bold text-amber-600">
                        ₱{pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-semibold text-emerald-600">
                        ₱{paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-extrabold text-slate-900">
                        ₱{totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedDoctorId(doctor.id);
                            setSelectedConsultationIds([]);
                          }}
                          className="rounded-xl px-3 py-1.5 text-xs inline-flex items-center gap-1 hover:bg-orange-50 hover:text-orange-600 hover:ring-orange-200"
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
