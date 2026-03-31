import { zodResolver } from '@hookform/resolvers/zod';
import { QrCode, Search, UserRoundPlus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { formatDateLabel } from '../../lib/utils';
import { useCreatePatient, usePatients } from './hooks/use-patients';

const patientSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  sex: z.enum(['male', 'female', 'other']),
  birthDate: z.string().min(1),
  mobileNumber: z.string().min(5),
  email: z.email(),
  address: z.string().min(4),
  bloodType: z.string().min(1),
  allergies: z.string().min(1),
  medicalHistory: z.string().min(1),
  emergencyContactName: z.string().min(2),
  emergencyContactPhone: z.string().min(5),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export function PatientsPage() {
  const { data: patients = [] } = usePatients();
  const createPatient = useCreatePatient();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      sex: 'female',
      birthDate: '',
      mobileNumber: '',
      email: '',
      address: '',
      bloodType: '',
      allergies: 'None reported',
      medicalHistory: 'No significant medical history yet',
      emergencyContactName: '',
      emergencyContactPhone: '',
    },
  });

  const filteredPatients = patients.filter((patient) =>
    `${patient.firstName} ${patient.lastName} ${patient.email} ${patient.qrCode}`
      .toLowerCase()
      .includes(deferredSearch.toLowerCase()),
  );

  const onSubmit = form.handleSubmit(async (values) => {
    await createPatient.mutateAsync({
      ...values,
      userId: null,
      qrCode: '',
    });
    form.reset();
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Patient management</p>
              <CardTitle className="mt-2 text-3xl">Unified patient registry</CardTitle>
              <p className="mt-2 text-sm text-slate-500">Every patient record now gets a unique QR code for faster SOAP chart access.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" to="/app/patients/scan">
                <QrCode className="mr-2 size-4" />
                Scan patient QR
              </Link>
              <div className="flex w-full max-w-sm items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <Search className="size-4 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search patient or QR code"
                  value={search}
                />
              </div>
            </div>
          </div>
        </Card>

        {filteredPatients.length === 0 ? (
          <EmptyState
            description="Add your first patient to start building medical history, consultations, and billing records."
            icon={UserRoundPlus}
            title="No patients found"
          />
        ) : (
          <div className="space-y-4">
            {filteredPatients.map((patient) => (
              <Card key={patient.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-xl font-semibold text-slate-950">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <Badge>{patient.bloodType || 'Unspecified'}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{patient.email} • {patient.mobileNumber}</p>
                    <p className="mt-1 text-sm text-slate-500">Born {formatDateLabel(patient.birthDate)}</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">QR {patient.qrCode}</p>
                  </div>
                  <Link className="text-sm font-semibold text-[var(--color-primary)]" to={`/app/patients/${patient.id}`}>
                    Open record
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardTitle>Register patient</CardTitle>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField error={form.formState.errors.firstName?.message} label="First name">
              <Input {...form.register('firstName')} />
            </FormField>
            <FormField error={form.formState.errors.lastName?.message} label="Last name">
              <Input {...form.register('lastName')} />
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Sex">
              <select className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" {...form.register('sex')}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            <FormField error={form.formState.errors.birthDate?.message} label="Birth date">
              <Input type="date" {...form.register('birthDate')} />
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField error={form.formState.errors.mobileNumber?.message} label="Mobile number">
              <Input {...form.register('mobileNumber')} />
            </FormField>
            <FormField error={form.formState.errors.email?.message} label="Email">
              <Input {...form.register('email')} />
            </FormField>
          </div>
          <FormField error={form.formState.errors.address?.message} label="Address">
            <Input {...form.register('address')} />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField error={form.formState.errors.bloodType?.message} label="Blood type">
              <Input {...form.register('bloodType')} />
            </FormField>
            <FormField error={form.formState.errors.allergies?.message} label="Allergies">
              <Input {...form.register('allergies')} />
            </FormField>
          </div>
          <FormField error={form.formState.errors.medicalHistory?.message} label="Medical history">
            <Textarea {...form.register('medicalHistory')} />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField error={form.formState.errors.emergencyContactName?.message} label="Emergency contact">
              <Input {...form.register('emergencyContactName')} />
            </FormField>
            <FormField error={form.formState.errors.emergencyContactPhone?.message} label="Emergency number">
              <Input {...form.register('emergencyContactPhone')} />
            </FormField>
          </div>
          <Button className="w-full" disabled={createPatient.isPending} type="submit">
            {createPatient.isPending ? 'Saving...' : 'Create patient record'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

