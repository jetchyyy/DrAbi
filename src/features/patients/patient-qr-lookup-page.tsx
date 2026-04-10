import { Camera, QrCode, Search, StopCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { getPatientByQrCode } from '../../lib/local-db';
import { extractPatientQrCode } from './patient-qr';

type DetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type DetectorConstructor = new (options?: { formats?: string[] }) => DetectorInstance;

export function PatientQrLookupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('qr') ?? '';
  const [value, setValue] = useState(initialQuery);
  const [error, setError] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'unsupported' | 'denied'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<DetectorInstance | null>(null);

  const normalizedCode = useMemo(() => extractPatientQrCode(value), [value]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState((current) => (current === 'unsupported' ? current : 'idle'));
    setCameraMessage('');
  };

  useEffect(() => {
    if (!initialQuery) {
      return;
    }

    const patient = getPatientByQrCode(extractPatientQrCode(initialQuery));
    if (patient) {
      void navigate(`/app/patients/${patient.id}?source=qr`, { replace: true });
      return;
    }

    setError('That QR code is not linked to a patient record yet.');
  }, [initialQuery, navigate]);

  useEffect(() => {
    const detectorConstructor = (window as typeof window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!detectorConstructor) {
      setCameraState('unsupported');
      return;
    }

    detectorRef.current = new detectorConstructor({ formats: ['qr_code'] });
  }, []);

  useEffect(
    () => () => {
      stopCamera();
    },
    [],
  );

  useEffect(() => {
    if (cameraState !== 'active' || !videoRef.current || !detectorRef.current) {
      return;
    }

    let cancelled = false;

    const scanFrame = async () => {
      if (cancelled || !videoRef.current || !detectorRef.current) {
        return;
      }

      try {
        const detected = await detectorRef.current.detect(videoRef.current);
        const rawValue = detected[0]?.rawValue ?? '';
        const code = extractPatientQrCode(rawValue);
        if (code) {
          setValue(rawValue);
          const patient = getPatientByQrCode(code);
          if (patient) {
            stopCamera();
            void navigate(`/app/patients/${patient.id}?source=qr`);
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
  }, [cameraState, navigate]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setCameraMessage('This device or browser does not support camera access.');
      return;
    }

    setError('');
    setCameraState('requesting');
    setCameraMessage('Requesting camera permission...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState('active');
      setCameraMessage('Camera ready. Point it at the patient QR code.');
    } catch {
      setCameraState('denied');
      setCameraMessage('Camera permission was denied. You can still paste the patient QR code manually.');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedCode) {
      setError('Scan a patient QR code or paste the patient code.');
      return;
    }

    const patient = getPatientByQrCode(normalizedCode);
    if (!patient) {
      setError('That QR code is not linked to a patient record yet.');
      return;
    }

    setError('');
    void navigate(`/app/patients/${patient.id}?source=qr`);
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
              <Button className="gap-2" onClick={() => void startCamera()} type="button">
                <Camera className="size-4" />
                {cameraState === 'active' ? 'Restart camera' : 'Allow camera and scan'}
              </Button>
              {cameraState === 'active' ? (
                <Button className="gap-2" onClick={stopCamera} type="button" variant="secondary">
                  <StopCircle className="size-4" />
                  Stop camera
                </Button>
              ) : null}
            </div>
            {cameraMessage ? <p className="text-sm text-slate-600">{cameraMessage}</p> : null}
            {cameraState === 'active' ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-black">
                <video className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
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
            <Button className="gap-2" type="submit">
              <Search className="size-4" />
              Open patient chart
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

      <Card className="bg-slate-950 text-white">
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">How this works</p>
        <CardTitle className="mt-2 text-white">Doctor scanning workflow</CardTitle>
        <div className="mt-5 space-y-4 text-sm text-slate-300">
          <p>The page asks for camera permission before opening the live scanner.</p>
          <p>Once the patient QR is detected, the app opens the matching patient chart automatically.</p>
          <p>From the chart, the doctor can save the full consultation record, SOAP notes, and prescription details.</p>
        </div>
      </Card>
    </div>
  );
}
