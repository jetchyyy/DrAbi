import { Camera, QrCode, ScanLine, Search, StopCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { extractBookingReceiptCode } from './booking-receipt';
import { useBookingReceipt, useMarkBookingPaid } from './hooks/use-bookings';

type DetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type DetectorConstructor = new (options?: { formats?: string[] }) => DetectorInstance;

function formatFeeLabel(feeType: 'consultation' | 'follow_up' | 'service_fee') {
  if (feeType === 'follow_up') return 'Follow-up Fee';
  if (feeType === 'consultation') return 'Consultation Fee';
  return 'Medical Service Fee';
}

export function BookingReceiptScanPage() {
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('receipt') ?? '';
  const [value, setValue] = useState(initialQuery);
  const [submittedReceiptCode, setSubmittedReceiptCode] = useState(extractBookingReceiptCode(initialQuery));
  const [error, setError] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'unsupported' | 'denied'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<DetectorInstance | null>(null);
  const normalizedCode = useMemo(() => extractBookingReceiptCode(value), [value]);
  const { data: booking, isLoading } = useBookingReceipt(submittedReceiptCode || null);
  const markPaid = useMarkBookingPaid();
  const canMarkPaid = can('billing.manage');

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
    if (!submittedReceiptCode) {
      return;
    }

    if (!isLoading && !booking) {
      setError('That receipt QR is not linked to a booking yet.');
    } else if (booking) {
      setError('');
    }
  }, [booking, isLoading, submittedReceiptCode]);

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
        const code = extractBookingReceiptCode(rawValue);
        if (code) {
          setValue(rawValue);
          setSubmittedReceiptCode(code);
          setError('');
          stopCamera();
          return;
        }
      } catch {
        setCameraMessage('Camera is active. Align the booking receipt QR inside the frame.');
      }

      window.setTimeout(scanFrame, 450);
    };

    void scanFrame();

    return () => {
      cancelled = true;
    };
  }, [cameraState]);

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
      setCameraMessage('Camera ready. Point it at the booking receipt QR.');
    } catch {
      setCameraState('denied');
      setCameraMessage('Camera permission was denied. You can still paste the receipt code manually.');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedCode) {
      setError('Scan the receipt QR code or paste the receipt code.');
      return;
    }

    setSubmittedReceiptCode(normalizedCode);
    setError('');
  };

  const handleMarkPaid = async () => {
    if (!booking) {
      return;
    }

    const result = await markPaid.mutateAsync(booking.receiptCode);
    toast.success(result.booking?.paymentStatus === 'paid' ? 'Payment recorded and receipt tagged for staff.' : 'Booking updated.');
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card>
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Receipt Scan</p>
        <CardTitle className="mt-2 text-3xl">Scan patient booking receipt</CardTitle>
        <p className="mt-3 max-w-2xl text-sm text-slate-500">
          Cashier can confirm payment from the receipt QR, and staff can verify whether the patient is already cleared to proceed.
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
            <span className="mb-2 block text-sm font-medium text-slate-700">Receipt QR link or code</span>
            <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <QrCode className="size-5 text-slate-400" />
              <Input
                className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                onChange={(event) => setValue(event.target.value)}
                placeholder="Paste scanned receipt result here"
                value={value}
              />
            </div>
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" type="submit">
              <Search className="size-4" />
              Find booking receipt
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
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Receipt Result</p>
        <CardTitle className="mt-2">Booking payment status</CardTitle>
        {!submittedReceiptCode ? (
          <p className="mt-5 text-sm text-slate-500">Scan or paste a patient receipt to load the booking details here.</p>
        ) : isLoading ? (
          <p className="mt-5 text-sm text-slate-500">Loading booking receipt...</p>
        ) : !booking ? (
          <p className="mt-5 text-sm text-rose-600">No booking was found for that receipt.</p>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{booking.serviceName}</p>
                  <p className="mt-1 text-sm text-slate-500">{booking.doctorName ?? 'Clinic medical service'}</p>
                </div>
                <Badge intent={booking.paymentStatus === 'paid' ? 'success' : 'warning'}>
                  {booking.paymentStatus === 'paid' ? 'Paid' : 'Pending Cashier'}
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Receipt code</p>
                  <p className="mt-1 font-mono font-semibold text-slate-950">{booking.receiptCode}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Charge</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatFeeLabel(booking.feeType)} - {formatCurrency(booking.feeAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Preferred schedule</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {booking.preferredDate} at {booking.preferredTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Booking status</p>
                  <p className="mt-1 font-semibold text-slate-950">{booking.status}</p>
                </div>
              </div>
            </div>

            {canMarkPaid && booking.paymentStatus !== 'paid' ? (
              <Button className="w-full gap-2" disabled={markPaid.isPending} onClick={() => void handleMarkPaid()} type="button">
                <ScanLine className="size-4" />
                {markPaid.isPending ? 'Recording payment...' : 'Mark paid and issue billing record'}
              </Button>
            ) : null}

            {!canMarkPaid ? (
              <p className="text-sm text-slate-500">This view is read-only for staff without cashier billing permission.</p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
