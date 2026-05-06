import { zodResolver } from '@hookform/resolvers/zod';
import { parse } from 'date-fns';
import { Eye, EyeOff, Loader2Icon } from 'lucide-react';
import { useEffect, useState, type LabelHTMLAttributes, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { useAuth } from '../auth-context';

const REGISTER_DRAFT_KEY = 'patient-register-draft-v1';
const bloodTypeOptions = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const allergyOptions = [
  '',
  'None',
  'Penicillin',
  'Sulfa drugs',
  'Aspirin',
  'Ibuprofen',
  'Latex',
  'Peanuts',
  'Seafood',
  'Dust mites',
  'Other',
] as const;

const registerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().min(1, 'Phone number is required'),
  sex: z.union([z.literal('MALE'), z.literal('FEMALE')]),
  bloodType: z.string().optional(),
  birthDate: z.string().min(1, 'Birth date is required'),
  address: z.string().min(1, 'Address is required'),
  allergies: z.string().optional(),
  medicalHistory: z.string().optional(),
  emergencyContactName: z.string().min(1, 'Emergency contact name is required'),
  emergencyContactPhone: z.string().min(1, 'Emergency contact phone is required'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;
type RegisterFieldName = keyof RegisterFormValues;

const stepConfigs: ReadonlyArray<{
  readonly title: string;
  readonly description: string;
  readonly fields: readonly RegisterFieldName[];
}> = [
  {
    title: 'Account & sign-in',
    description: "How you'll sign in to book and manage appointments.",
    fields: ['fullName', 'email', 'password'],
  },
  {
    title: 'Contact & demographics',
    description: 'So we can reach you and tailor care.',
    fields: ['phone', 'sex', 'bloodType', 'birthDate', 'address'],
  },
  {
    title: 'Health snapshot',
    description: 'Optional but helpful for your care team before your visit.',
    fields: ['allergies', 'medicalHistory'],
  },
  {
    title: 'Emergency contact',
    description: "Someone we can call if we can't reach you.",
    fields: ['emergencyContactName', 'emergencyContactPhone'],
  },
];

export function PatientRegisterForm() {
  const navigate = useNavigate();
  const { signUpPatient } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      phone: '',
      sex: 'MALE',
      bloodType: '',
      birthDate: '',
      address: '',
      allergies: '',
      medicalHistory: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
    },
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(REGISTER_DRAFT_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { values?: Partial<RegisterFormValues>; currentStep?: number };
      if (parsed.values) {
        form.reset({ ...form.getValues(), ...parsed.values });
      }
      if (typeof parsed.currentStep === 'number') {
        setCurrentStep(Math.min(Math.max(parsed.currentStep, 0), stepConfigs.length - 1));
      }
    } catch {
      window.localStorage.removeItem(REGISTER_DRAFT_KEY);
    }
  }, [form]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const subscription = form.watch((values) => {
      window.localStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify({ values, currentStep }));
    });
    return () => subscription.unsubscribe();
  }, [form, currentStep]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const computedMedicalHistory = values.bloodType
        ? `Blood type: ${values.bloodType}${values.medicalHistory ? `\n${values.medicalHistory}` : ''}`
        : values.medicalHistory ?? '';
      await signUpPatient({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        phone: values.phone,
        sex: values.sex === 'MALE' ? 'male' : 'female',
        birthDate: parse(values.birthDate, 'yyyy-MM-dd', new Date()).toISOString(),
        address: values.address,
        allergies: values.allergies ?? '',
        medicalHistory: computedMedicalHistory,
        emergencyContactName: values.emergencyContactName,
        emergencyContactPhone: values.emergencyContactPhone,
      });
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(REGISTER_DRAFT_KEY);
      }
      toast.success('Account created', {
        description: 'You can sign in with your new credentials.',
      });
      navigate('/portal/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete registration';
      toast.error('Registration failed', { description: message });
    }
  });

  const currentConfig = stepConfigs[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === stepConfigs.length - 1;

  async function handleNextStep() {
    const isValid = await form.trigger([...currentConfig.fields]);
    if (!isValid) return;
    setCurrentStep((value) => Math.min(value + 1, stepConfigs.length - 1));
  }

  function handlePreviousStep() {
    setCurrentStep((value) => Math.max(value - 1, 0));
  }

  return (
    <>
      <header className="mb-10">
        
        <h2 className="mt-4 font-display text-[1.875rem] font-semibold leading-[1.12] tracking-[-0.03em] text-slate-900 sm:text-[2rem]">
          Create your account
        </h2>
        <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-slate-500">
          Add your details once so we can book visits and reach you when it matters. You can update
          anything later from your profile.
        </p>
      </header>

      <form className="space-y-8" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>
              Step {currentStep + 1} of {stepConfigs.length}
            </span>
            <span>{Math.round(((currentStep + 1) / stepConfigs.length) * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300"
              style={{ width: `${((currentStep + 1) / stepConfigs.length) * 100}%` }}
            />
          </div>
        </div>

        {currentStep === 0 ? (
          <section className="space-y-4">
            <div className="border-b border-slate-200/90 pb-2">
              <h3 className="text-sm font-semibold text-slate-900">{currentConfig.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{currentConfig.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField error={form.formState.errors.fullName?.message}>
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" autoComplete="name" {...form.register('fullName')} placeholder="Jordan Lee" />
              </FormField>
              <FormField error={form.formState.errors.email?.message}>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...form.register('email')} placeholder="you@example.com" />
              </FormField>
              <div className="sm:col-span-2">
                <FormField error={form.formState.errors.password?.message}>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="pr-10"
                      {...form.register('password')}
                      placeholder="Minimum 8 characters"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Use 8+ chars with uppercase, lowercase, number, and symbol.</p>
                </FormField>
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="space-y-4">
            <div className="border-b border-slate-200/90 pb-2">
              <h3 className="text-sm font-semibold text-slate-900">{currentConfig.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{currentConfig.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField error={form.formState.errors.phone?.message}>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" autoComplete="tel" {...form.register('phone')} placeholder="+1 — — — ----" />
              </FormField>
              <FormField error={form.formState.errors.sex?.message}>
                <Label htmlFor="sex">Sex</Label>
                <Select id="sex" {...form.register('sex')}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </FormField>
              <FormField error={form.formState.errors.bloodType?.message}>
                <Label htmlFor="bloodType">Blood type</Label>
                <Select id="bloodType" {...form.register('bloodType')}>
                  {bloodTypeOptions.map((option) => (
                    <option key={option || 'unknown-blood-type'} value={option}>
                      {option || 'Select blood type'}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="sm:col-span-2 max-w-[11.5rem]">
                <FormField error={form.formState.errors.birthDate?.message}>
                  <Label htmlFor="birthDate">Date of birth</Label>
                  <Input id="birthDate" type="date" {...form.register('birthDate')} />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField error={form.formState.errors.address?.message}>
                  <Label htmlFor="address">Street address</Label>
                  <Input id="address" autoComplete="street-address" {...form.register('address')} placeholder="Unit, street, city, postal code" />
                </FormField>
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="space-y-4">
            <div className="border-b border-slate-200/90 pb-2">
              <h3 className="text-sm font-semibold text-slate-900">{currentConfig.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{currentConfig.description}</p>
            </div>
            <div className="space-y-4">
              <FormField error={undefined}>
                <Label htmlFor="allergies">Allergies</Label>
                <Select id="allergies" {...form.register('allergies')}>
                  {allergyOptions.map((option) => (
                    <option key={option || 'allergy-unset'} value={option}>
                      {option || 'Select allergy status'}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField error={undefined}>
                <Label htmlFor="medicalHistory">Medical history</Label>
                <Textarea id="medicalHistory" rows={4} {...form.register('medicalHistory')} placeholder="Surgeries, chronic conditions, medications — or leave blank" />
              </FormField>
            </div>
          </section>
        ) : null}

        {currentStep === 3 ? (
          <section className="space-y-4">
            <div className="border-b border-slate-200/90 pb-2">
              <h3 className="text-sm font-semibold text-slate-900">{currentConfig.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{currentConfig.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField error={form.formState.errors.emergencyContactName?.message}>
                <Label htmlFor="emergencyContactName">Contact name</Label>
                <Input id="emergencyContactName" {...form.register('emergencyContactName')} placeholder="Full name" />
              </FormField>
              <FormField error={form.formState.errors.emergencyContactPhone?.message}>
                <Label htmlFor="emergencyContactPhone">Contact phone</Label>
                <Input id="emergencyContactPhone" autoComplete="tel" {...form.register('emergencyContactPhone')} placeholder="+1 — — — ----" />
              </FormField>
            </div>
          </section>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            className="h-12 rounded-full px-6"
            onClick={handlePreviousStep}
            disabled={isFirstStep || form.formState.isSubmitting}
          >
            Back
          </Button>
          {isLastStep ? (
            <Button
              type="submit"
              className="h-12 rounded-full px-7 text-sm shadow-lg shadow-black/15"
              variant="primary"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon aria-hidden className="h-4 w-4 animate-spin" /> Creating your account…
                </span>
              ) : (
                'Create account'
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="h-12 rounded-full px-7 text-sm shadow-lg shadow-black/15"
              variant="primary"
              onClick={handleNextStep}
              disabled={form.formState.isSubmitting}
            >
              Continue
            </Button>
          )}
        </div>
      </form>
    </>
  );
}

interface FormFieldProps {
  readonly children: ReactNode;
  readonly error?: string;
}

function FormField({ children, error }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      {children}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

function Label({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-sm font-medium text-slate-700 ${className}`.trim()} {...props} />;
}
