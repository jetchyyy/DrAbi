import { zodResolver } from '@hookform/resolvers/zod';
import { Search, UserRoundPlus, Users } from 'lucide-react';
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
    `${patient.firstName} ${patient.lastName} ${patient.email}`
      .toLowerCase()
      .includes(deferredSearch.toLowerCase()),
  );

  const onSubmit = form.handleSubmit(async (values) => {
    await createPatient.mutateAsync({ ...values, userId: null });
    form.reset();
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        {/* Page header */}
        <div className="bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-600 text-white shrink-0">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Patient Management</p>
                <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">Unified Patient Registry</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5 w-full max-w-sm">
              <Search className="size-4 text-slate-400 shrink-0" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                value={search}
              />
            </div>
          </div>
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-2">
            <span className="text-xs font-bold text-slate-500">{filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} found</span>
          </div>
        </div>

        {/* Patient list */}
        {filteredPatients.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 bg-white p-12 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-orange-50 border border-orange-100 flex items-center justify-center mb-3">
              <UserRoundPlus className="size-6 text-orange-600" />
            </div>
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950 mb-1">No patients found</p>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">Add your first patient to start building medical history, consultations, and billing records.</p>
          </div>
        ) : (
          <div className="border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            {filteredPatients.map((patient) => (
              <div key={patient.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 bg-orange-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0">
                    {getInitials(patient.firstName, patient.lastName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-950">{patient.firstName} {patient.lastName}</p>
                      <Badge className="rounded-none text-[10px] uppercase tracking-widest font-bold">{patient.bloodType || 'Unspecified'}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{patient.email} · {patient.mobileNumber}</p>
                    <p className="text-xs text-slate-400">Born {formatDateLabel(patient.birthDate)}</p>
                  </div>
                </div>
                <Link className="text-xs font-extrabold uppercase tracking-widest text-orange-600 hover:underline shrink-0" to={`/app/patients/${patient.id}`}>
                  Open Record →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register patient form */}
      <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-orange-600 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">New Patient</p>
          <p className="text-sm font-bold text-white mt-0.5">Register Patient Record</p>
        </div>
        <form className="divide-y divide-slate-100" onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Personal Information</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField error={form.formState.errors.firstName?.message} label="First name"><Input {...form.register('firstName')} /></FormField>
              <FormField error={form.formState.errors.lastName?.message} label="Last name"><Input {...form.register('lastName')} /></FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Sex">
                <select className="w-full border border-slate-200 bg-white px-3 py-2.5 text-sm" {...form.register('sex')}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <FormField error={form.formState.errors.birthDate?.message} label="Birth date"><Input type="date" {...form.register('birthDate')} /></FormField>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Contact Details</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField error={form.formState.errors.mobileNumber?.message} label="Mobile number"><Input {...form.register('mobileNumber')} /></FormField>
              <FormField error={form.formState.errors.email?.message} label="Email"><Input {...form.register('email')} /></FormField>
            </div>
            <FormField error={form.formState.errors.address?.message} label="Address"><Input {...form.register('address')} /></FormField>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Medical Info</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField error={form.formState.errors.bloodType?.message} label="Blood type"><Input {...form.register('bloodType')} /></FormField>
              <FormField error={form.formState.errors.allergies?.message} label="Allergies"><Input {...form.register('allergies')} /></FormField>
            </div>
            <FormField error={form.formState.errors.medicalHistory?.message} label="Medical history"><Textarea {...form.register('medicalHistory')} /></FormField>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Emergency Contact</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField error={form.formState.errors.emergencyContactName?.message} label="Contact name"><Input {...form.register('emergencyContactName')} /></FormField>
              <FormField error={form.formState.errors.emergencyContactPhone?.message} label="Contact phone"><Input {...form.register('emergencyContactPhone')} /></FormField>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50">
            <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 font-extrabold uppercase tracking-widest text-sm py-5" disabled={createPatient.isPending} type="submit">
              {createPatient.isPending ? 'Saving…' : 'Create Patient Record'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
