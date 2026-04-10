import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '../../../app/query-client';
import { getDatabase } from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import {
  createBookingLiveOrDemo,
  getBookingByReceiptCodeLiveOrDemo,
  getBookingListForUser,
  getCurrentPatient,
  listBlockedBookingSlotsLiveOrDemo,
  markBookingPaidAndCreateInvoiceLiveOrDemo,
} from '../../../lib/supabase-clinic';
import { isSupabaseConfigured } from '../../../lib/supabase';
import type { Booking } from '../../../types/domain';

export function useMyBookings(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.myBookings(userId),
    queryFn: async () => {
      if (!userId) return [];
      return getBookingListForUser(userId);
    },
    enabled: Boolean(userId),
  });
}

export function useCurrentPatient(userId: string | null, email: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.currentPatient(userId ?? email ?? null),
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        if (!email) return null;
        return getDatabase().patients.find((patient) => patient.email === email) ?? null;
      }
      if (!userId) return null;
      return getCurrentPatient(userId);
    },
    enabled: Boolean(userId || email),
  });
}

export function useBlockedBookingSlots(input: { date: string | null; doctorId?: string | null; serviceId?: string | null }) {
  return useQuery({
    queryKey: queryKeys.blockedBookingSlots(input.date, input.doctorId ?? null, input.serviceId ?? null),
    queryFn: () =>
      listBlockedBookingSlotsLiveOrDemo({
        date: input.date ?? '',
        doctorId: input.doctorId ?? null,
        serviceId: input.serviceId ?? null,
      }),
    enabled: Boolean(input.date && (input.doctorId || input.serviceId)),
  });
}

export function useBookingReceipt(receiptCode: string | null) {
  return useQuery({
    queryKey: queryKeys.bookingReceipt(receiptCode),
    queryFn: async () => {
      if (!receiptCode) return null;
      return getBookingByReceiptCodeLiveOrDemo(receiptCode);
    },
    enabled: Boolean(receiptCode),
  });
}

export function useMarkBookingPaid() {
  return useMutation({
    mutationFn: (receiptCode: string) => markBookingPaidAndCreateInvoiceLiveOrDemo(receiptCode),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookingReceipt(result.booking?.receiptCode ?? null) });
    },
  });
}

export function useCreateBooking(userId: string | null) {
  return useMutation({
    mutationFn: async (payload: Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'status'>) =>
      createBookingLiveOrDemo({
        patientId: payload.patientId,
        serviceId: payload.serviceId,
        doctorId: payload.doctorId,
        preferredDate: payload.preferredDate,
        preferredTime: payload.preferredTime,
        intakeNotes: payload.intakeNotes,
        feeType: payload.feeType,
        feeAmount: payload.feeAmount,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myBookings(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentPatient(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
    },
  });
}
