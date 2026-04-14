import { Camera, QrCode, Search, StopCircle } from 'lucide-react';
import jsQR from 'jsqr';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { queryClient } from '../../app/query-client';
import { queryKeys } from '../../lib/query-keys';
import { getPatientByQrCodeLiveOrDemo } from '../../lib/supabase-clinic';
import { updatePatientLiveOrDemo } from '../../lib/supabase-clinic';
import type { Patient } from '../../types/domain';
import { validatePatientConsultationAccess } from '../consultation/services/consultation-access-service';
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

  const normalizedCode = useMemo(() => extractPatientQrCode(value), [value]);

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
      if (access.reason === 'unpaid_balance' || access.reason === 'no_invoice') {
        setBlockingAlert({
          open: true,
          title: 'Unpaid Balance',
          message: access.message,
        });
        return;
      }

      setError(`Unable to validate payment right now. ${access.message}`);
      return;
    }

    const params = new URLSearchParams({ source: 'qr' });
    if (access.appointmentId) {
      params.set('appointmentId', access.appointmentId);
    }

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
    <div className="mx-auto grid max-w-5xl gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">QR lookup</p>
        <CardTitle className="mt-2 text-3xl">Scan patient QR for consultation entry</CardTitle>
        <p className="mt-3 max-w-2xl text-sm text-slate-500">
          Doctors can allow camera access, scan the patient QR, and jump straight into the patient chart to record consultation details.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap gap-3">
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
            {cameraMessage ? <p className="text-sm text-slate-600">{cameraMessage}</p> : null}
            {cameraState === 'requesting' || cameraState === 'active' ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-black">
                <video className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
                <canvas className="hidden" ref={canvasRef} />
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">QR link or patient code</span>
            <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <QrCode className="size-5 text-slate-400" />
              <Input
                className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                onChange={(event) => setValue(event.target.value)}
                placeholder="Paste scanned QR result here"
                value={value}
              />
            </div>
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" type="submit" disabled={isValidating}>
              <Search className="size-4" />
              {isValidating ? 'Validating payment...' : 'Proceed to consultation'}
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

      <Card className="bg-slate-950 text-white">
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">How this works</p>
        <CardTitle className="mt-2 text-white">Doctor scanning workflow</CardTitle>
        <div className="mt-5 space-y-4 text-sm text-slate-300">
          <p>The page asks for camera permission before opening the live scanner.</p>
          <p>Once the patient QR is detected, latest payment status is checked before consultation access.</p>
          <p>Paid patients are routed directly to SOAP consultation; unpaid balances are blocked for cashier follow-up.</p>
        </div>
      </Card>
    </div>
  );
}
