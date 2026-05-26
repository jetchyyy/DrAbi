import { zodResolver } from '@hookform/resolvers/zod';
import { parse } from 'date-fns';
import { Eye, EyeOff, Loader2Icon } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useEffect, useMemo, useRef, useState, type LabelHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { isSupabaseConfigured } from '../../../lib/supabase';
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
const monthOptions = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

function padToTwoDigits(value: number) {
  return value.toString().padStart(2, '0');
}

const registerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  phone: z.string().min(1, 'Phone number is required'),
  sex: z.union([z.literal('MALE'), z.literal('FEMALE')]),
  bloodType: z.string().optional(),
  birthDate: z.string().min(1, 'Birth date is required'),
  address: z.string().min(1, 'Address is required'),
  allergies: z.string().optional(),
  medicalHistory: z.string().optional(),
  emergencyContactName: z.string().min(1, 'Emergency contact name is required'),
  emergencyContactPhone: z.string().min(1, 'Emergency contact phone is required'),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
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
    fields: ['fullName', 'email', 'password', 'confirmPassword'],
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
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [selectedBirthYear, setSelectedBirthYear] = useState('');
  const [selectedBirthMonth, setSelectedBirthMonth] = useState('');
  const [selectedBirthDay, setSelectedBirthDay] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const [showAllergyDropdown, setShowAllergyDropdown] = useState(false);
  const allergyContainerRef = useRef<HTMLDivElement>(null);
  const [confirmModalEmail, setConfirmModalEmail] = useState('');
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '+63',
      sex: 'MALE',
      bloodType: '',
      birthDate: '',
      address: '',
      allergies: '',
      medicalHistory: '',
      emergencyContactName: '',
      emergencyContactPhone: '+63',
    },
  });
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const currentMonthPadded = padToTwoDigits(currentMonth);
  const birthDateValue = form.watch('birthDate');
  const yearOptions = useMemo(() => Array.from({ length: 121 }, (_, index) => String(currentYear - index)), [currentYear]);
  const maxMonth = selectedBirthYear === String(currentYear) ? currentMonth : 12;
  const availableMonthOptions = monthOptions.filter((month) => Number(month.value) <= maxMonth);
  const daysInSelectedMonth = selectedBirthMonth
    ? new Date(
        selectedBirthYear ? Number(selectedBirthYear) : 2000,
        Number(selectedBirthMonth),
        0,
      ).getDate()
    : 31;
  const maxDay =
    selectedBirthYear === String(currentYear) && selectedBirthMonth === currentMonthPadded
      ? Math.min(daysInSelectedMonth, currentDay)
      : daysInSelectedMonth;
  const dayOptions = Array.from({ length: maxDay }, (_, index) => padToTwoDigits(index + 1));

  useEffect(() => {
    if (!birthDateValue) return;
    const [year = '', month = '', day = ''] = birthDateValue.split('-');
    if (!year || !month || !day) return;
    setSelectedBirthYear(year);
    setSelectedBirthMonth(month);
    setSelectedBirthDay(day);
  }, [birthDateValue]);

  function handleBirthDatePartChange(part: 'year' | 'month' | 'day', value: string) {
    const inputYear = part === 'year' ? value : selectedBirthYear;
    const inputMonth = part === 'month' ? value : selectedBirthMonth;
    const inputDay = part === 'day' ? value : selectedBirthDay;

    setSelectedBirthYear(inputYear);
    setSelectedBirthMonth(inputMonth);
    setSelectedBirthDay(inputDay);

    if (!inputYear || !inputMonth || !inputDay) {
      form.setValue('birthDate', '', { shouldDirty: true, shouldValidate: false });
      return;
    }

    const normalizedMonthNumber = Math.min(
      Number(inputMonth),
      inputYear === String(currentYear) ? currentMonth : 12,
    );
    const normalizedMonth = padToTwoDigits(normalizedMonthNumber);
    const monthDayLimit = new Date(Number(inputYear), normalizedMonthNumber, 0).getDate();
    const dateDayLimit =
      inputYear === String(currentYear) && normalizedMonth === currentMonthPadded
        ? Math.min(monthDayLimit, currentDay)
        : monthDayLimit;
    const normalizedDay = padToTwoDigits(Math.min(Number(inputDay), dateDayLimit));
    setSelectedBirthMonth(normalizedMonth);
    setSelectedBirthDay(normalizedDay);

    form.setValue('birthDate', `${inputYear}-${normalizedMonth}-${normalizedDay}`, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

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

  useEffect(() => {
    if (!showAllergyDropdown) return;
    const handler = (e: MouseEvent) => {
      if (allergyContainerRef.current && !allergyContainerRef.current.contains(e.target as Node)) {
        setShowAllergyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAllergyDropdown]);

  const allergySuggestions = allergyOptions
    .filter((opt) => opt !== '')
    .filter((opt) =>
      allergyInput === '' || opt.toLowerCase().includes(allergyInput.toLowerCase()),
    );

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
      }, captchaToken);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(REGISTER_DRAFT_KEY);
      }
      setConfirmModalEmail(values.email);
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
      {/* Email confirmation modal — rendered at document root so fixed covers the full viewport */}
      {confirmModalEmail ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Close */}
            <button
              type="button"
              aria-label="Close and go to sign in"
              onClick={() => navigate('/login')}
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>

            {/* Envelope illustration */}
            <div className="flex justify-center pt-12 pb-6">
              <svg width="120" height="96" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                {/* Envelope body */}
                <rect x="8" y="32" width="104" height="64" rx="4" fill="var(--color-primary)" opacity="0.85" />
                {/* Letter */}
                <rect x="28" y="10" width="64" height="56" rx="3" fill="#f1f5f9" />
                <rect x="36" y="22" width="48" height="4" rx="2" fill="#cbd5e1" />
                <rect x="36" y="32" width="48" height="4" rx="2" fill="#cbd5e1" />
                <rect x="36" y="42" width="36" height="4" rx="2" fill="#cbd5e1" />
                {/* Envelope flap */}
                <path d="M8 36L60 68L112 36" stroke="white" strokeWidth="2" fill="none" />
                <path d="M8 32L60 64L112 32L112 36L60 68L8 36Z" fill="var(--color-primary)" />
                {/* Shadow line */}
                <rect x="24" y="92" width="72" height="3" rx="1.5" fill="#e2e8f0" />
              </svg>
            </div>

            {/* Content */}
            <div className="px-8 pb-6 text-center">
              <h2 id="confirm-modal-title" className="text-2xl font-bold text-slate-900">
                Email Confirmation
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                We have sent an email to{' '}
                <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                  {confirmModalEmail}
                </span>{' '}
                to confirm the validity of your email address. After receiving the email, follow the link provided to complete your registration
              </p>
            </div>

          </div>
        </div>,
        document.body,
      ) : null}

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
              <div className="sm:col-span-2">
                <FormField error={form.formState.errors.confirmPassword?.message}>
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="pr-10"
                      {...form.register('confirmPassword')}
                      placeholder="Re-enter your password"
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
                <Input id="phone" autoComplete="tel" {...form.register('phone')} placeholder="+63 9XX XXX XXXX" />
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
              <div className="sm:col-span-2">
                <FormField error={form.formState.errors.birthDate?.message}>
                  <Label htmlFor="birthMonth">Date of birth</Label>
                  <Input type="hidden" {...form.register('birthDate')} />
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      id="birthMonth"
                      aria-label="Birth month"
                      value={selectedBirthMonth}
                      onChange={(event) => handleBirthDatePartChange('month', event.target.value)}
                    >
                      <option value="">Month</option>
                      {availableMonthOptions.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      aria-label="Birth day"
                      value={selectedBirthDay}
                      disabled={!selectedBirthMonth}
                      onChange={(event) => handleBirthDatePartChange('day', event.target.value)}
                    >
                      <option value="">Day</option>
                      {dayOptions.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </Select>
                    <Select
                      aria-label="Birth year"
                      value={selectedBirthYear}
                      onChange={(event) => handleBirthDatePartChange('year', event.target.value)}
                    >
                      <option value="">Year</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <p className="text-xs text-slate-500">Select Month, Day, and Year.</p>
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
                <div className="relative" ref={allergyContainerRef}>
                  <Input
                    id="allergies"
                    autoComplete="off"
                    placeholder="e.g. Penicillin, Peanuts, None"
                    value={allergyInput}
                    onChange={(e) => {
                      setAllergyInput(e.target.value);
                      form.setValue('allergies', e.target.value);
                      setShowAllergyDropdown(true);
                    }}
                    onFocus={() => setShowAllergyDropdown(true)}
                  />
                  {showAllergyDropdown && allergySuggestions.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {allergySuggestions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className="flex w-full items-center px-3.5 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setAllergyInput(opt);
                            form.setValue('allergies', opt);
                            setShowAllergyDropdown(false);
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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
                <Input id="emergencyContactPhone" autoComplete="tel" {...form.register('emergencyContactPhone')} placeholder="+63 9XX XXX XXXX" />
              </FormField>
            </div>
            {isSupabaseConfigured && (
              <div className="flex justify-center py-4 border-t border-slate-100 mt-6">
                <Turnstile
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setCaptchaToken(token)}
                />
              </div>
            )}
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

