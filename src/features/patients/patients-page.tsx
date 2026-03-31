import { zodResolver } from '@hookform/resolvers/zod';
import { QrCode, Search, UserRoundPlus, Users } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
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

function getInitials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

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
    `${patient.firstName} ${patient.lastName} ${patient.email} ${patient.qrCode}`.toLowerCase().includes(deferredSearch.toLowerCase()),
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
      <div className="space-y-4">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Patient Management</p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Unified Patient Registry</h1>
                <p className="mt-1 text-sm text-slate-500">Every patient record now gets a unique QR code for faster SOAP chart access.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link className="inline-flex items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" to="/app/patients/scan">
                <QrCode className="mr-2 size-4" />
                Scan patient QR
              </Link>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search patient, email, or QR code"
                  value={search}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
            <span className="text-xs font-bold text-slate-500">{filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} found</span>
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center border border-orange-100 bg-orange-50">
              <UserRoundPlus className="size-6 text-orange-600" />
            </div>
            <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-slate-950">No patients found</p>
            <p className="max-w-xs text-xs leading-relaxed text-slate-500">Add your first patient to start building medical history, consultations, and billing records.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 bg-white shadow-sm">
            {filteredPatients.map((patient) => (
              <div key={patient.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-orange-600 text-sm font-extrabold text-white">
                    {getInitials(patient.firstName, patient.lastName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-950">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <Badge className="rounded-none text-[10px] font-bold uppercase tracking-widest">{patient.bloodType || 'Unspecified'}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {patient.email} - {patient.mobileNumber}
                    </p>
                    <p className="text-xs text-slate-400">Born {formatDateLabel(patient.birthDate)}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">QR {patient.qrCode}</p>
                  </div>
                </div>
                <Link className="shrink-0 text-xs font-extrabold uppercase tracking-widest text-orange-600 hover:underline" to={`/app/patients/${patient.id}`}>
                  Open Record
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="bg-orange-600 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">New Patient</p>
          <p className="mt-0.5 text-sm font-bold text-white">Register Patient Record</p>
        </div>
        <form className="divide-y divide-slate-100" onSubmit={onSubmit}>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Personal Information</p>
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
                <select className="w-full border border-slate-200 bg-white px-3 py-2.5 text-sm" {...form.register('sex')}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <FormField error={form.formState.errors.birthDate?.message} label="Birth date">
                <Input type="date" {...form.register('birthDate')} />
              </FormField>
            </div>
          </div>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Contact Details</p>
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
          </div>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Medical Info</p>
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
          </div>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Emergency Contact</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField error={form.formState.errors.emergencyContactName?.message} label="Contact name">
                <Input {...form.register('emergencyContactName')} />
              </FormField>
              <FormField error={form.formState.errors.emergencyContactPhone?.message} label="Contact phone">
                <Input {...form.register('emergencyContactPhone')} />
              </FormField>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-4">
            <Button className="w-full rounded-none bg-orange-600 py-5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" disabled={createPatient.isPending} type="submit">
              {createPatient.isPending ? 'Saving...' : 'Create Patient Record'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
