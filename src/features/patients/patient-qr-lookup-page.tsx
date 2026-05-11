import { AlertCircle, Camera, CheckCircle2, CircleDashed, QrCode, Search, ShieldCheck, StopCircle, UserRoundSearch } from 'lucide-react';
import jsQR from 'jsqr';
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { queryClient } from '../../app/query-client';
import { queryKeys } from '../../lib/query-keys';
import { getPatientByQrCodeLiveOrDemo } from '../../lib/supabase-clinic';
import { updatePatientLiveOrDemo } from '../../lib/supabase-clinic';
import type { Invoice, Patient } from '../../types/domain';
import { validatePatientConsultationAccess } from '../consultation/services/consultation-access-service';
import { useInvoices } from '../billing/api/billing-mutations';
import { usePatients } from './hooks/use-patients';
import { extractPatientQrCode } from './patient-qr';

function readQrFromVideoFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return '';
  }

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return '';
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  return decoded?.data?.trim() ?? '';
}

function getPatientPaymentState(patientId: string, invoices: Invoice[]): 'paid' | 'pending' | 'none' {
  const patientInvoices = invoices
    .filter((inv) => inv.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (patientInvoices.length === 0) {
    return 'none';
  }

  const latest = patientInvoices[0];
  if (latest.paymentStatus === 'unpaid' || latest.paymentStatus === 'partial') {
    return 'pending';
  }

  return 'paid';
}

function getPatientAge(birthDate: string) {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function PatientSearchResultRow({
  patient,
  paymentState,
}: {
  patient: Patient;
  paymentState: 'paid' | 'pending' | 'none';
}) {
  const isPending = paymentState === 'pending';
  const age = getPatientAge(patient.birthDate);
  const fullName = `${patient.firstName} ${patient.lastName}`;

  const paymentBadge = isPending
    ? <Badge intent="warning">Pending</Badge>
    : paymentState === 'paid'
      ? <Badge intent="success">Paid</Badge>
      : <Badge intent="neutral">No invoice</Badge>;

  const content = (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-slate-950">{fullName}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {patient.sex.charAt(0).toUpperCase() + patient.sex.slice(1)}, {age} yrs
          {patient.mobileNumber ? ` · ${patient.mobileNumber}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {paymentBadge}
        {isPending ? null : (
          <span className="text-xs font-semibold text-orange-600">View chart →</span>
        )}
      </div>
    </div>
  );

  if (isPending) {
    return (
      <div className="cursor-not-allowed border-b border-slate-100 opacity-60 last:border-b-0">
        {content}
      </div>
    );
  }

  return (
    <Link
      className="block border-b border-slate-100 transition hover:bg-orange-50 last:border-b-0"
      to={`/app/patients/${patient.id}`}
    >
      {content}
    </Link>
  );
}

function getLocalCalendarKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function PatientQrLookupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('qr') ?? '';
  const [mode, setMode] = useState<'qr' | 'search'>('qr');
  const [value, setValue] = useState(initialQuery);
  const [error, setError] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'unsupported' | 'denied'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [blockingAlert, setBlockingAlert] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Patient search state
  const [patientSearch, setPatientSearch] = useState('');
  const deferredPatientSearch = useDeferredValue(patientSearch);
  const { data: allPatients = [] } = usePatients();
  const { data: invoices = [] } = useInvoices();

  const normalizedCode = useMemo(() => extractPatientQrCode(value), [value]);
  const filteredPatients = useMemo(() => {
    if (!deferredPatientSearch.trim()) return [];
    const q = deferredPatientSearch.toLowerCase();
    return allPatients.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.mobileNumber.includes(q),
    );
  }, [deferredPatientSearch, allPatients]);
  const cameraStatusLabel = useMemo(() => {
    if (cameraState === 'active') {
      return 'Camera active';
    }
    if (cameraState === 'requesting') {
      return 'Waiting for permission';
    }
    if (cameraState === 'denied') {
      return 'Permission denied';
    }
    if (cameraState === 'unsupported') {
      return 'Camera unsupported';
    }
    return 'Camera idle';
  }, [cameraState]);

  const recordClinicVisit = async (patient: Patient) => {
    const todayKey = getLocalCalendarKey(new Date().toISOString());
    const lastVisitKey = getLocalCalendarKey(patient.lastClinicVisitAt);

    if (lastVisitKey && lastVisitKey === todayKey) {
      return;
    }

    const visitTimestamp = new Date().toISOString();

    await updatePatientLiveOrDemo(patient.id, {
      userId: patient.userId ?? null,
      qrCode: patient.qrCode,
      intakeSource: patient.intakeSource,
      visitStatus: 'visited_clinic',
      lastClinicVisitAt: visitTimestamp,
      firstName: patient.firstName,
      lastName: patient.lastName,
      sex: patient.sex,
      birthDate: patient.birthDate,
      mobileNumber: patient.mobileNumber,
      email: patient.email,
      address: patient.address,
      bloodType: patient.bloodType,
      allergies: patient.allergies,
      medicalHistory: patient.medicalHistory,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
    });

    void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    void queryClient.invalidateQueries({ queryKey: queryKeys.patientDetail(patient.id) });
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraState((current) => (current === 'unsupported' ? current : 'idle'));
    setCameraMessage('');
  };

  const continueToConsultation = async (patient: Patient) => {
    setIsValidating(true);
    setError('');

    void recordClinicVisit(patient).catch(() => {
      // Best effort: consultation access should continue even if the visit flag update fails.
    });

    const access = await validatePatientConsultationAccess(patient.id);
    setIsValidating(false);

    if (!access.allowed) {
      if (
        access.reason === 'unpaid_balance' ||
        access.reason === 'no_invoice' ||
        access.reason === 'missing_vitals'
      ) {
        setBlockingAlert({
          open: true,
          title: access.reason === 'missing_vitals' ? 'Vitals Required' : 'Unpaid Balance',
          message: access.message,
        });
        return;
      }

      setError(`Unable to validate payment right now. ${access.message}`);
      return;
    }

    if (!access.appointmentId) {
      setError('Payment is paid but no appointment is linked for this visit. Please contact front desk.');
      return;
    }

    const params = new URLSearchParams({ source: 'qr' });
    params.set('appointmentId', access.appointmentId);
    void navigate(`/app/consultation/${patient.id}?${params.toString()}`);
  };

  useEffect(() => {
    if (!initialQuery) {
      return;
    }

    void (async () => {
      const patient = await getPatientByQrCodeLiveOrDemo(extractPatientQrCode(initialQuery));
      if (patient) {
        await continueToConsultation(patient);
        return;
      }

      setError('That QR code is not linked to a patient record yet.');
    })();
  }, [initialQuery]);

  useEffect(
    () => () => {
      stopCamera();
    },
    [],
  );

  useEffect(() => {
    if (cameraState !== 'active' || !videoRef.current || !canvasRef.current) {
      return;
    }

    let cancelled = false;

    const scanFrame = async () => {
      if (cancelled || !videoRef.current || !canvasRef.current) {
        return;
      }

      try {
        const rawValue = readQrFromVideoFrame(videoRef.current, canvasRef.current);
        const code = extractPatientQrCode(rawValue);
        if (code && !isValidating) {
          setValue(rawValue);
          const patient = await getPatientByQrCodeLiveOrDemo(code);
          if (patient) {
            stopCamera();
            await continueToConsultation(patient);
            return;
          }

          setError('That QR code is not linked to a patient record yet.');
        }
      } catch {
        setCameraMessage('Camera is active. Align the patient QR inside the frame.');
      }

      window.setTimeout(scanFrame, 450);
    };

    void scanFrame();

    return () => {
      cancelled = true;
    };
  }, [cameraState, isValidating]);

  useEffect(() => {
    if (cameraState !== 'requesting' && cameraState !== 'active') {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraMessage('Camera is ready. Tap Start camera again if preview does not appear.');
    });
  }, [cameraState]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setCameraMessage('This device or browser does not support camera access.');
      return;
    }

    stopCamera();
    setError('');
    setCameraState('requesting');
    setCameraMessage('Requesting camera permission...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraState('active');
      setCameraMessage('Camera ready. Point it at the patient QR code.');
    } catch {
      setCameraState('denied');
      setCameraMessage('Camera permission was denied. You can still paste the patient QR code manually.');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedCode) {
      setError('Scan a patient QR code or paste the patient code.');
      return;
    }

    if (isValidating) {
      return;
    }

    const patient = await getPatientByQrCodeLiveOrDemo(normalizedCode);
    if (!patient) {
      setError('That QR code is not linked to a patient record yet.');
      return;
    }

    setError('');
    await continueToConsultation(patient);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">QR Lookup</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Scan patient QR for consultation entry</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Allow camera access, scan the patient QR, or search by name to view the patient chart.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        <button
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            mode === 'qr'
              ? 'bg-white text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setMode('qr')}
          type="button"
        >
          <QrCode className="size-4" />
          Scan QR
        </button>
        <button
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            mode === 'search'
              ? 'bg-white text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setMode('search')}
          type="button"
        >
          <UserRoundSearch className="size-4" />
          Search patients
        </button>
      </div>

      {mode === 'search' ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <Card>
              <CardTitle>Search patients by name</CardTitle>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-400/20 transition-all">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none"
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Type patient name or mobile number…"
                  type="text"
                  value={patientSearch}
                />
              </div>

              {patientSearch.trim() && (
                <div className="mt-4">
                  {filteredPatients.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500">
                      No patients found matching &ldquo;{patientSearch}&rdquo;
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                          {filteredPatients.length} result{filteredPatients.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      {filteredPatients.map((patient) => {
                        const paymentState = getPatientPaymentState(patient.id, invoices);
                        return (
                          <PatientSearchResultRow
                            key={patient.id}
                            patient={patient}
                            paymentState={paymentState}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {!patientSearch.trim() && (
                <p className="mt-3 text-xs text-slate-400">Start typing to find patients.</p>
              )}
            </Card>
          </div>

          {/* Info panel */}
          <div className="flex flex-col gap-4">
            <Card className="bg-slate-950 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Patient search</p>
              <CardTitle className="mt-1 text-white">Payment status guide</CardTitle>
              <div className="mt-4 space-y-3 text-sm text-slate-400">
                <div className="flex items-start gap-3 rounded-xl bg-slate-900/60 px-4 py-3">
                  <span className="mt-0.5 inline-block size-2.5 shrink-0 rounded-full bg-emerald-400" />
                  <p><span className="font-semibold text-emerald-300">Paid</span> — Patient has a cleared invoice. Click to open their chart.</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-900/60 px-4 py-3">
                  <span className="mt-0.5 inline-block size-2.5 shrink-0 rounded-full bg-amber-400" />
                  <p><span className="font-semibold text-amber-300">Pending</span> — Outstanding balance. Row is disabled; direct to front desk for payment clearance.</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-900/60 px-4 py-3">
                  <span className="mt-0.5 inline-block size-2.5 shrink-0 rounded-full bg-slate-500" />
                  <p><span className="font-semibold text-slate-300">No invoice</span> — No billing record found. Chart is still accessible.</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          {/* Camera status badge */}
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Scan or paste patient QR</CardTitle>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
              cameraState === 'active'
                ? 'bg-emerald-50 text-emerald-700'
                : cameraState === 'denied' || cameraState === 'unsupported'
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-slate-100 text-slate-500'
            }`}>
              <CircleDashed className={`size-3 ${cameraState === 'active' ? 'animate-spin' : ''}`} />
              {cameraStatusLabel}
            </span>
          </div>

          {/* Step indicator */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { n: 1, label: 'Start camera or paste code' },
              { n: 2, label: 'Confirm detected patient QR' },
              { n: 3, label: 'Proceed to consultation' },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary,#16a34a)] text-[10px] font-bold text-white">
                  {step.n}
                </span>
                <p className="text-xs leading-snug text-slate-600">{step.label}</p>
              </div>
            ))}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {/* Camera panel */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button className="gap-2" onClick={() => void startCamera()} type="button" disabled={isValidating}>
                  <Camera className="size-4" />
                  {cameraState === 'active' ? 'Restart camera' : 'Allow camera and scan'}
                </Button>
                {cameraState === 'active' ? (
                  <Button className="gap-2" onClick={stopCamera} type="button" variant="secondary" disabled={isValidating}>
                    <StopCircle className="size-4" />
                    Stop camera
                  </Button>
                ) : null}
              </div>
              {cameraMessage ? (
                <p className="text-sm text-slate-600">{cameraMessage}</p>
              ) : null}
              {cameraState === 'requesting' || cameraState === 'active' ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-black">
                  <video className="aspect-video w-full object-cover opacity-90" muted playsInline ref={videoRef} />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-40 w-40 rounded-2xl border-2 border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
                  </div>
                  <p className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white/90">
                    Keep QR inside the frame
                  </p>
                  <canvas className="hidden" ref={canvasRef} />
                </div>
              ) : null}
            </div>

            {/* Manual input */}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">QR link or patient code</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[var(--color-primary,#16a34a)] focus-within:ring-2 focus-within:ring-[var(--color-primary,#16a34a)]/20 transition-all">
                <QrCode className="size-5 shrink-0 text-slate-400" />
                <Input
                  className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="Paste scanned QR result here"
                  value={value}
                />
              </div>
              {normalizedCode ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  Parsed code: <span className="font-mono font-semibold text-slate-700">{normalizedCode}</span>
                </div>
              ) : null}
            </label>

            {/* Validating state */}
            {isValidating ? (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--color-primary,#16a34a)]" />
                Validating payment status...
              </div>
            ) : null}

            {/* Error */}
            {error ? (
              <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button className="gap-2" type="submit" disabled={isValidating}>
                <Search className="size-4" />
                {isValidating ? 'Validating payment...' : 'Proceed to consultation'}
              </Button>
              <Button
                className="gap-2"
                type="button"
                variant="ghost"
                disabled={isValidating || (!value && !error)}
                onClick={() => {
                  setValue('');
                  setError('');
                }}
              >
                Clear
              </Button>
              <Link
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                to="/app/patients"
              >
                Back to patients
              </Link>
            </div>
          </form>
        </Card>

        <FeedbackModal
          open={blockingAlert.open}
          title={blockingAlert.title}
          message={blockingAlert.message}
          variant="error"
          autoCloseMs={120000}
          onClose={() => {
            setBlockingAlert({ open: false, title: '', message: '' });
            void navigate('/app/appointments');
          }}
        />

        {/* How this works panel */}
        <div className="flex flex-col gap-4">
          <Card className="bg-slate-950 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">How this works</p>
            <CardTitle className="mt-1 text-white">Doctor scanning workflow</CardTitle>

            <div className="mt-5 space-y-3">
              {/* Safety check highlight */}
              <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <ShieldCheck className="size-4 shrink-0" />
                  Consultation safety checks
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  The QR lookup validates patient payment status before opening SOAP consultation.
                </p>
              </div>

              {/* Steps list */}
              {[
                'The page asks for camera permission before opening the live scanner.',
                'Once the patient QR is detected, latest payment status is checked before consultation access.',
                'Paid patients are routed directly to SOAP consultation; unpaid balances are blocked for cashier follow-up.',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-900/60 px-4 py-3">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick tip */}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Quick tip</p>
            <p className="mt-1.5 text-sm text-slate-600">
              If camera access is unavailable, paste the patient QR code or URL directly into the input field above.
            </p>
          </div>
        </div>
      </div>

      )}
    </div>
  );
}
