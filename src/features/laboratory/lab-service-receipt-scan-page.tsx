import { Camera, QrCode, ScanLine, Search, StopCircle } from 'lucide-react';
import jsQR from 'jsqr';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useAuth } from '../auth/auth-context';
import { useLabRequest } from '../lab-requests/hooks/use-lab-requests';
import { extractLabServiceReceiptRequestId } from './lab-service-receipt';

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

export function LabServiceReceiptScanPage() {
  const { can, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('request') ?? '';
  const [value, setValue] = useState(initialQuery);
  const [submittedRequestId, setSubmittedRequestId] = useState(extractLabServiceReceiptRequestId(initialQuery));
  const [error, setError] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'unsupported' | 'denied'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const normalizedRequestId = useMemo(() => extractLabServiceReceiptRequestId(value), [value]);
  const { data: request, isLoading } = useLabRequest(submittedRequestId || null);
  const canOpenLaboratory = can('laboratory.view');
  const canProcessLaboratory = profile?.role === 'lab_staff' || profile?.role === 'owner_admin';

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
        const requestId = extractLabServiceReceiptRequestId(rawValue);
        if (requestId) {
          setValue(rawValue);
          setSubmittedRequestId(requestId);
          setError('');
          stopCamera();
          return;
        }
      } catch {
        setCameraMessage('Camera is active. Align the laboratory receipt QR inside the frame.');
      }

      window.setTimeout(scanFrame, 450);
    };

    void scanFrame();

    return () => {
      cancelled = true;
    };
  }, [cameraState]);

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
      setCameraMessage('Camera ready. Point it at the laboratory receipt QR.');
    } catch {
      setCameraState('denied');
      setCameraMessage('Camera permission was denied. You can still paste the request link manually.');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedRequestId) {
      setError('Scan the laboratory receipt QR code or paste the request link.');
      return;
    }

    setSubmittedRequestId(normalizedRequestId);
    setError('');
  };

  const resolvedError =
    error ||
    (submittedRequestId && !isLoading && !request
      ? 'That QR is not linked to a laboratory request yet.'
      : '');

  return (
    <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card>
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Lab Receipt Scan</p>
        <CardTitle className="mt-2 text-3xl">Scan paid lab service receipt</CardTitle>
        <p className="mt-3 max-w-2xl text-sm text-slate-500">
          Laboratory and clinic staff can scan the patient QR receipt here to verify payment and continue the laboratory workflow.
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
            {cameraState === 'requesting' || cameraState === 'active' ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-black">
                <video className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
                <canvas className="hidden" ref={canvasRef} />
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Receipt QR link or request id</span>
            <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <QrCode className="size-5 text-slate-400" />
              <Input
                className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                onChange={(event) => setValue(event.target.value)}
                placeholder="Paste scanned lab receipt result here"
                value={value}
              />
            </div>
          </label>

          {resolvedError ? <p className="text-sm text-rose-600">{resolvedError}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" type="submit">
              <Search className="size-4" />
              Find paid request
            </Button>
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              to="/app/billing"
            >
              Back to billing
            </Link>
          </div>
        </form>
      </Card>

      <Card className="h-full">
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Request Result</p>
        <CardTitle className="mt-2">Paid laboratory request</CardTitle>
        {!submittedRequestId ? (
          <p className="mt-5 text-sm text-slate-500">Scan or paste a laboratory receipt to load the request details here.</p>
        ) : isLoading ? (
          <p className="mt-5 text-sm text-slate-500">Loading laboratory request...</p>
        ) : !request ? (
          <p className="mt-5 text-sm text-rose-600">No laboratory request was found for that receipt.</p>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{request.serviceName ?? request.serviceCategory}</p>
                  <p className="mt-1 text-sm text-slate-500">{request.patientName ?? request.patientId}</p>
                </div>
                <Badge intent={request.status === 'completed' ? 'success' : 'info'}>
                  {request.status}
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Lab request</p>
                  <p className="mt-1 break-all font-mono font-semibold text-slate-950">{request.id}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Patient</p>
                  <p className="mt-1 font-semibold text-slate-950">{request.patientName ?? request.patientId}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Sample status</p>
                  <p className="mt-1 font-semibold text-slate-950">{request.sampleStatus}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Result status</p>
                  <p className="mt-1 font-semibold text-slate-950">{request.resultStatus}</p>
                </div>
                {request.patientNotes ? (
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Notes</p>
                    <p className="mt-1 font-semibold text-slate-950">{request.patientNotes}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Payment has already been recorded for this service. The patient can proceed to the laboratory workflow.
            </div>

            {canOpenLaboratory ? (
              <Link to={`/app/laboratory?request=${encodeURIComponent(request.id)}`}>
                <Button className="w-full gap-2" type="button">
                  <ScanLine className="size-4" />
                  {canProcessLaboratory ? 'Open request in laboratory workflow' : 'Open laboratory page'}
                </Button>
              </Link>
            ) : (
              <p className="text-sm text-slate-500">This account can verify the paid request here, but does not have laboratory page access.</p>
            )}

          </div>
        )}
      </Card>
    </div>
  );
}
