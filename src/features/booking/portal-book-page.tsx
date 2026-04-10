import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useClinicSettingsData, useBookableServices, useDoctorAvailability, useDoctorDirectory } from '../../hooks/use-clinic-data';
import { buildDailyTimeSlots, formatTimeLabel, getAvailableTimeSlotsForDate } from '../../lib/doctor-availability';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useBlockedBookingSlots, useCreateBooking, useCurrentPatient } from './hooks/use-bookings';

const bookingSchema = z.object({
  serviceId: z.string().min(1),
  doctorId: z.string().optional(),
  preferredDate: z.string().min(1),
  preferredTime: z.string().min(1),
  intakeNotes: z.string().min(3),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function PortalBookPage() {
  const { profile, session } = useAuth();
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: services = [] } = useBookableServices();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: currentPatient } = useCurrentPatient(session?.user.id ?? null, profile?.email);
  const createBooking = useCreateBooking(session?.user.id ?? null);
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      serviceId: '',
      doctorId: '',
      preferredDate: '',
      preferredTime: '',
      intakeNotes: '',
    },
  });

  const selectedServiceId = form.watch('serviceId');
  const selectedDoctorId = form.watch('doctorId');
  const selectedDate = form.watch('preferredDate');
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;
  const requiresDoctor = selectedService?.serviceType === 'consultation' || selectedService?.serviceType === 'follow_up';
  const { data: doctorAvailability = [] } = useDoctorAvailability(requiresDoctor ? selectedDoctorId || null : null);
  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const selectedFeeAmount = selectedService
    ? selectedService.serviceType === 'follow_up'
      ? selectedDoctor?.followUpFee ?? 0
      : selectedService.serviceType === 'consultation'
        ? selectedDoctor?.consultationFee ?? 0
        : selectedService.price
    : 0;
  const derivedFeeType = selectedService?.serviceType === 'follow_up'
    ? 'follow_up'
    : selectedService?.serviceType === 'consultation'
      ? 'consultation'
      : 'service_fee';
  const { data: blockedSlots = [] } = useBlockedBookingSlots({
    date: selectedDate || null,
    doctorId: requiresDoctor ? selectedDoctorId || null : null,
    serviceId: !requiresDoctor ? selectedServiceId || null : null,
  });

  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !selectedService) {
      return [];
    }

    const baseSlots = requiresDoctor
      ? getAvailableTimeSlotsForDate(doctorAvailability, selectedDate)
      : buildDailyTimeSlots(selectedService.durationMinutes || clinicSettings?.appointmentSlotMinutes || 30);

    return baseSlots.filter((time) => !blockedSlots.includes(time));
  }, [blockedSlots, clinicSettings?.appointmentSlotMinutes, doctorAvailability, requiresDoctor, selectedDate, selectedService]);

  useEffect(() => {
    if (services[0] && !form.getValues('serviceId')) {
      form.setValue('serviceId', services[0].id);
    }
  }, [form, services]);

  useEffect(() => {
    if (!requiresDoctor) {
      if (form.getValues('doctorId')) {
        form.setValue('doctorId', '');
      }
      return;
    }

    if (doctors[0] && !form.getValues('doctorId')) {
      form.setValue('doctorId', doctors[0].id);
    }
  }, [doctors, form, requiresDoctor]);

  useEffect(() => {
    const currentPreferredTime = form.getValues('preferredTime');
    if (availableTimeSlots.length === 0) {
      if (currentPreferredTime) {
        form.setValue('preferredTime', '');
      }
      return;
    }

    if (!availableTimeSlots.includes(currentPreferredTime)) {
      form.setValue('preferredTime', availableTimeSlots[0]);
    }
  }, [availableTimeSlots, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!currentPatient) {
      toast.error('Your patient profile is not ready yet. Please sign in again or contact the clinic.');
      return;
    }

    if (requiresDoctor && !values.doctorId) {
      toast.error('Please select a doctor for consultation or follow-up booking.');
      return;
    }

    if (requiresDoctor && selectedFeeAmount <= 0) {
      toast.error('The selected doctor has no professional fee set yet. Please choose another doctor or contact the clinic.');
      return;
    }

    const createdBooking = await createBooking.mutateAsync({
      patientId: currentPatient.id,
      serviceId: values.serviceId,
      doctorId: requiresDoctor ? values.doctorId ?? '' : '',
      preferredDate: values.preferredDate,
      preferredTime: values.preferredTime,
      intakeNotes: values.intakeNotes,
      feeType: derivedFeeType,
      feeAmount: selectedFeeAmount,
      receiptCode: '',
      paymentStatus: 'pending_cashier',
    });

    const receiptCode = 'receipt_code' in createdBooking ? createdBooking.receipt_code : createdBooking.receiptCode;
    toast.success(`Booking submitted. Present receipt ${receiptCode} at cashier before proceeding to staff.`);
    form.reset({
      serviceId: values.serviceId,
      doctorId: requiresDoctor ? values.doctorId : '',
      preferredDate: '',
      preferredTime: '',
      intakeNotes: '',
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <Badge intent="info">Booking portal</Badge>
        <CardTitle className="mt-4 text-3xl">Book a medical service</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          You are signed in as {profile?.fullName ?? profile?.email}. Consultation and follow-up fees follow the doctor&apos;s professional fees, while other services use the catalog service fee.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Service">
              <Select {...form.register('serviceId')}>
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
                  selectedService?.serviceType === 'consultation'
                    ? 'Consultation'
                    : selectedService?.serviceType === 'follow_up'
                      ? 'Follow-up'
                      : 'Medical Service'
                }
              />
            </FormField>
          </div>

          {requiresDoctor ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Doctor">
                <Select {...form.register('doctorId')}>
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                      {doctor.specialtyName ? ` (${doctor.specialtyName})` : ''}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Charge type">
                <Input
                  disabled
                  readOnly
                  value={selectedService?.serviceType === 'follow_up' ? 'Follow-up Fee' : 'Consultation Fee'}
                />
              </FormField>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Preferred date">
              <Input type="date" {...form.register('preferredDate')} />
            </FormField>
            <FormField label="Preferred time">
              <Select {...form.register('preferredTime')} disabled={availableTimeSlots.length === 0}>
                <option value="">{selectedDate ? 'No available slots' : 'Select a date first'}</option>
                {availableTimeSlots.map((time) => (
                  <option key={time} value={time}>
                    {formatTimeLabel(time)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Booking charge">
              <Input
                disabled
                readOnly
                value={
                  requiresDoctor && !selectedDoctor
                    ? 'Select a doctor first'
                    : selectedService
                      ? formatCurrency(selectedFeeAmount)
                      : 'Select a service first'
                }
              />
            </FormField>
            <FormField label="Cashier flow">
              <Input disabled readOnly value="Present receipt QR at cashier before staff processing" />
            </FormField>
          </div>

          {selectedDate && availableTimeSlots.length === 0 ? (
            <p className="text-sm font-medium text-rose-600">This time slot set is already full or unavailable for the selected date.</p>
          ) : null}

          <FormField label="Reason or intake notes">
            <Textarea {...form.register('intakeNotes')} />
          </FormField>
          <Button
            className="w-full"
            disabled={createBooking.isPending || !currentPatient || availableTimeSlots.length === 0 || (requiresDoctor && !selectedDoctorId)}
            type="submit"
          >
            {createBooking.isPending ? 'Submitting...' : 'Submit booking request'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>After booking</CardTitle>
        <div className="mt-5 space-y-4 text-sm text-slate-600">
          <p>Once booked, the slot is blocked so another patient cannot take the same date and time.</p>
          <p>Your booking receipt will appear in <Link className="font-semibold text-[var(--color-primary)]" to="/portal/my-bookings">My Bookings</Link> with a QR code for cashier and staff scanning.</p>
          <p>Patients must present the receipt to cashier first, complete payment, then proceed to staff for the actual test or service.</p>
          <p>Need to update your details first? Return to the <Link className="font-semibold text-[var(--color-primary)]" to="/portal">patient portal</Link>.</p>
        </div>
      </Card>
    </div>
  );
}
