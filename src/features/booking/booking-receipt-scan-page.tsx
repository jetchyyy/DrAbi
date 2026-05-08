import { Camera, CheckCircle2, Clock, QrCode, ScanLine, Search, StopCircle, User, Users } from 'lucide-react';
import jsQR from 'jsqr';
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
import { useBookingReceipt, useMarkBookingPaid, useSearchBookingsByPatientName } from './hooks/use-bookings';
import type { BookingListItem } from '../../lib/supabase-clinic';

function formatFeeLabel(feeType: 'consultation' | 'follow_up' | 'service_fee' | string | null | undefined) {
  if (feeType === 'follow_up') return 'Follow-up Fee';
  if (feeType === 'consultation') return 'Consultation Fee';
  return 'Medical Service Fee';
}

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

function BookingResultCard({
  booking,
  canMarkPaid,
  onMarkPaid,
  isPending,
}: {
  booking: BookingListItem;
  canMarkPaid: boolean;
  onMarkPaid: (receiptCode: string) => void;
  isPending: boolean;
}) {
  const isPaid = booking.paymentStatus === 'paid';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Patient name — prominent header */}
      {booking.patientName ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-slate-50 px-4 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary,#16a34a)] text-white">
            <User className="size-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient</p>
            <p className="text-base font-bold text-slate-950">{booking.patientName}</p>
          </div>
          <div className="ml-auto">
            <Badge intent={isPaid ? 'success' : 'warning'}>
              {isPaid ? 'Paid' : 'Pending Cashier'}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-base font-bold text-slate-950">{booking.serviceName}</p>
          <Badge intent={isPaid ? 'success' : 'warning'}>
            {isPaid ? 'Paid' : 'Pending Cashier'}
          </Badge>
        </div>
      )}

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Service</p>
          <p className="mt-0.5 font-semibold text-slate-900">{booking.serviceName}</p>
          {booking.doctorName ? (
            <p className="mt-0.5 text-xs text-slate-500">{booking.doctorName}</p>
          ) : null}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Receipt Code</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-slate-950">{booking.receiptCode}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Charge</p>
          <p className="mt-0.5 font-semibold text-slate-900">{formatFeeLabel(booking.feeType)}</p>
          <p className="text-xs font-semibold text-slate-500">{formatCurrency(booking.feeAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Schedule</p>
          <p className="mt-0.5 font-semibold text-slate-900">{booking.preferredDate}</p>
          <p className="text-xs text-slate-500">at {booking.preferredTime}</p>
        </div>
      </div>

      {canMarkPaid && !isPaid ? (
        <Button
          className="mt-4 w-full gap-2"
          disabled={isPending}
          onClick={() => onMarkPaid(booking.receiptCode)}
          type="button"
        >
          <CheckCircle2 className="size-4" />
          {isPending ? 'Recording payment...' : 'Mark paid and issue billing record'}
        </Button>
      ) : null}

      {isPaid ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="size-4" />
          Payment confirmed — cleared to proceed
        </div>
      ) : null}

      {!canMarkPaid && !isPaid ? (
        <p className="mt-4 text-xs text-slate-500">Read-only view — cashier billing permission required to mark paid.</p>
      ) : null}
    </div>
  );
}

export function BookingReceiptScanPage() {
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('receipt') ?? '';

  const [mode, setMode] = useState<'receipt' | 'patient'>(initialQuery ? 'receipt' : 'receipt');

  // Receipt scan state
  const [value, setValue] = useState(initialQuery);
  const [submittedReceiptCode, setSubmittedReceiptCode] = useState(extractBookingReceiptCode(initialQuery));
  const [receiptError, setReceiptError] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'unsupported' | 'denied'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const normalizedCode = useMemo(() => extractBookingReceiptCode(value), [value]);
  const { data: booking, isLoading: isReceiptLoading } = useBookingReceipt(submittedReceiptCode || null);
  const markPaid = useMarkBookingPaid();
  const canMarkPaid = can('billing.manage');

  // Patient name search state
  const [patientNameInput, setPatientNameInput] = useState('');
  const [submittedPatientName, setSubmittedPatientName] = useState<string | null>(null);
  const { data: patientBookings, isLoading: isPatientSearchLoading } = useSearchBookingsByPatientName(submittedPatientName);

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
    if (!submittedReceiptCode) {
      return;
    }

    if (!isReceiptLoading && !booking) {
      setReceiptError('That receipt QR is not linked to a booking yet.');
    } else if (booking) {
      setReceiptError('');
    }
  }, [booking, isReceiptLoading, submittedReceiptCode]);

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
        const code = extractBookingReceiptCode(rawValue);
        if (code) {
          setValue(rawValue);
          setSubmittedReceiptCode(code);
          setReceiptError('');
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
    setReceiptError('');
    setCameraState('requesting');
    setCameraMessage('Requesting camera permission...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraState('active');
      setCameraMessage('Camera ready. Point it at the booking receipt QR.');
    } catch {
      setCameraState('denied');
      setCameraMessage('Camera permission was denied. You can still paste the receipt code manually.');
    }
  };

  const handleReceiptSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedCode) {
      setReceiptError('Scan the receipt QR code or paste the receipt code.');
      return;
    }

    setSubmittedReceiptCode(normalizedCode);
    setReceiptError('');
  };

  const handlePatientSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = patientNameInput.trim();
    if (!trimmed) return;
    setSubmittedPatientName(trimmed);
  };

  const handleMarkPaid = async (receiptCode: string) => {
    const result = await markPaid.mutateAsync(receiptCode);
    toast.success(result.booking?.paymentStatus === 'paid' ? 'Payment recorded and receipt tagged for staff.' : 'Booking updated.');
  };

  const switchMode = (next: 'receipt' | 'patient') => {
    stopCamera();
    setMode(next);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Receipt Scan</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Scan patient booking receipt</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Confirm payment from a receipt QR code, or search a patient by name to see their pending booking.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => switchMode('receipt')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            mode === 'receipt'
              ? 'bg-white text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <QrCode className="size-4" />
          Scan Receipt
        </button>
        <button
          type="button"
          onClick={() => switchMode('patient')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            mode === 'patient'
              ? 'bg-white text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="size-4" />
          Search by Patient
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        {/* Left panel — input */}
        <Card>
          {mode === 'receipt' ? (
            <>
              <CardTitle>Scan or paste receipt</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Use the camera to scan the booking receipt QR, or paste the code manually.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleReceiptSubmit}>
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
                      <video className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
                      <canvas className="hidden" ref={canvasRef} />
                    </div>
                  ) : null}
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Receipt QR link or code</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[var(--color-primary,#16a34a)] focus-within:ring-2 focus-within:ring-[var(--color-primary,#16a34a)]/20 transition-all">
                    <QrCode className="size-5 shrink-0 text-slate-400" />
                    <Input
                      className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="Paste scanned receipt result here"
                      value={value}
                    />
                  </div>
                </label>

                {receiptError ? (
                  <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{receiptError}</p>
                ) : null}

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
            </>
          ) : (
            <>
              <CardTitle>Search by patient name</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Enter a patient's first or last name to find their pending booking payments.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handlePatientSearch}>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Patient name</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[var(--color-primary,#16a34a)] focus-within:ring-2 focus-within:ring-[var(--color-primary,#16a34a)]/20 transition-all">
                    <User className="size-5 shrink-0 text-slate-400" />
                    <Input
                      className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                      onChange={(event) => setPatientNameInput(event.target.value)}
                      placeholder="e.g. Juan dela Cruz"
                      value={patientNameInput}
                    />
                  </div>
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button className="gap-2" type="submit" disabled={!patientNameInput.trim()}>
                    <Search className="size-4" />
                    Search patient
                  </Button>
                  <Link
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    to="/app/billing"
                  >
                    Back to billing
                  </Link>
                </div>
              </form>
            </>
          )}
        </Card>

        {/* Right panel — always visible */}
        <Card className="h-full">
          {mode === 'receipt' ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Receipt Result</p>
              <CardTitle className="mt-1">Booking payment status</CardTitle>
              {!submittedReceiptCode ? (
                <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 py-10 text-center">
                  <ScanLine className="size-10 text-slate-300" />
                  <p className="text-sm text-slate-500">Scan or paste a patient receipt to load the booking details here.</p>
                </div>
              ) : isReceiptLoading ? (
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  <div className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--color-primary,#16a34a)]" />
                  Loading booking receipt...
                </div>
              ) : !booking ? (
                <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-4 text-sm font-medium text-rose-700">
                  No booking was found for that receipt.
                </div>
              ) : (
                <div className="mt-5">
                  <BookingResultCard
                    booking={booking}
                    canMarkPaid={canMarkPaid}
                    onMarkPaid={(code) => void handleMarkPaid(code)}
                    isPending={markPaid.isPending}
                  />

                  {booking.intakeNotes ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Intake Notes</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{booking.intakeNotes}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                    <Clock className="size-4 shrink-0 text-slate-400" />
                    <p className="text-xs text-slate-500">
                      Booking status: <span className="font-semibold capitalize text-slate-700">{booking.status}</span>
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Search Results</p>
              <CardTitle className="mt-1">Pending booking payments</CardTitle>
              {!submittedPatientName ? (
                <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 py-10 text-center">
                  <Users className="size-10 text-slate-300" />
                  <p className="text-sm text-slate-500">Search a patient by name to see their pending bookings here.</p>
                </div>
              ) : isPatientSearchLoading ? (
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  <div className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--color-primary,#16a34a)]" />
                  Searching for "{submittedPatientName}"...
                </div>
              ) : !patientBookings || patientBookings.length === 0 ? (
                <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  <Users className="mx-auto mb-2 size-8 text-slate-300" />
                  No pending bookings found for "{submittedPatientName}".
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {patientBookings.length} pending booking{patientBookings.length !== 1 ? 's' : ''} found
                  </p>
                  {patientBookings.map((b) => (
                    <BookingResultCard
                      key={b.id}
                      booking={b}
                      canMarkPaid={canMarkPaid}
                      onMarkPaid={(code) => void handleMarkPaid(code)}
                      isPending={markPaid.isPending && markPaid.variables === b.receiptCode}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

