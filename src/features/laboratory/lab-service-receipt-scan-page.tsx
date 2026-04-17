import { Camera, QrCode, ScanLine, Search, StopCircle } from 'lucide-react';
import jsQR from 'jsqr';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { getDatabase } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { createInvoiceLiveOrDemo, deleteInvoiceLiveOrDemo } from '../../lib/supabase-clinic';
import { useAuth } from '../auth/auth-context';
import { labRequestService } from '../lab-requests/api/lab-request-service';
import { useLabRequest } from '../lab-requests/hooks/use-lab-requests';
import { extractLabServiceReceiptRequestId } from './lab-service-receipt';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    const message = typeof errorRecord.message === 'string' ? errorRecord.message : '';
    const details = typeof errorRecord.details === 'string' ? errorRecord.details : '';
    if (message && details) {
      return `${message}: ${details}`;
    }
    if (message) {
      return message;
    }
  }

  return fallback;
}

function isMissingInvoiceServiceRequestColumnError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
  const details = String((error as { details?: unknown }).details ?? '').toLowerCase();

  return (
    (message.includes("could not find the 'service_request_id' column") && message.includes("invoices")) ||
    (details.includes('service_request_id') && details.includes('invoices'))
  );
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

export function LabServiceReceiptScanPage() {
  const { can, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('request') ?? '';
  const [value, setValue] = useState(initialQuery);
  const [submittedRequestId, setSubmittedRequestId] = useState(extractLabServiceReceiptRequestId(initialQuery));
  const [error, setError] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'unsupported' | 'denied'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const [linkedInvoice, setLinkedInvoice] = useState<{ requestId: string; invoiceId: string | null; invoiceNumber: string | null } | null>(null);
  const [autoProcessRedirectedRequestId, setAutoProcessRedirectedRequestId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const normalizedRequestId = useMemo(() => extractLabServiceReceiptRequestId(value), [value]);
  const { data: request, isLoading } = useLabRequest(submittedRequestId || null);
  const canMarkPaid = can('billing.manage');
  const canOpenLaboratory = can('laboratory.view');
  const canProcessLaboratory = profile?.role === 'lab_staff' || profile?.role === 'owner_admin';
  const isPaid = request?.paymentStatus === 'paid';

  useEffect(() => {
    if (!request?.id || !isPaid || !canProcessLaboratory) {
      return;
    }

    if (autoProcessRedirectedRequestId === request.id) {
      return;
    }

    setAutoProcessRedirectedRequestId(request.id);
    const timer = window.setTimeout(() => {
      navigate(`/app/laboratory?request=${encodeURIComponent(request.id)}`);
    }, 550);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoProcessRedirectedRequestId, canProcessLaboratory, isPaid, navigate, request?.id]);

  const markPaid = useMutation({
    mutationFn: async (requestId: string) => {
      const currentRequest = await labRequestService.getRequestById(requestId);
      if (!currentRequest) {
        throw new Error('Laboratory request not found.');
      }

      if (currentRequest.paymentStatus === 'paid') {
        return { request: currentRequest, invoiceNumber: currentRequest.receiptCode ?? null, invoiceId: null };
      }

      let amount = 0;
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('medical_services')
          .select('service_fee')
          .eq('id', currentRequest.serviceId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        amount = Number((data as { service_fee?: number | null } | null)?.service_fee ?? 0);
      } else {
        const localService = getDatabase().labServices.find((service) => service.id === currentRequest.serviceId) ?? null;
        amount = Number(localService?.price ?? 0);
      }

      if (amount <= 0) {
        throw new Error('This laboratory service has no valid fee yet. Update the service fee before recording payment.');
      }

      let invoicePatientId = currentRequest.patientId;
      if (isSupabaseConfigured && supabase) {
        const { data: directPatient, error: directPatientError } = await supabase
          .from('patients')
          .select('id')
          .eq('id', currentRequest.patientId)
          .maybeSingle();

        if (directPatientError) {
          throw directPatientError;
        }

        if (directPatient?.id) {
          invoicePatientId = directPatient.id;
        } else {
          const { data: mappedPatient, error: mappedPatientError } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', currentRequest.patientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (mappedPatientError) {
            throw mappedPatientError;
          }

          if (!mappedPatient?.id) {
            throw new Error('No patient intake record found for this request. Please register the patient in Patient Management first.');
          }

          invoicePatientId = mappedPatient.id;
        }
      } else {
        const localPatient = getDatabase().patients.find((patient) => patient.id === currentRequest.patientId || patient.userId === currentRequest.patientId) ?? null;
        if (!localPatient) {
          throw new Error('No patient intake record found for this request. Please register the patient in Patient Management first.');
        }
        invoicePatientId = localPatient.id;
      }

      let createdInvoiceId: string | null = null;
      const invoiceNumber = `INV-LAB-${Date.now()}`;

      try {
        const createdInvoice = await createInvoiceLiveOrDemo(
          {
            patientId: invoicePatientId,
            appointmentId: currentRequest.appointmentId,
            invoiceNumber,
            paymentStatus: 'paid',
            subtotal: amount,
            total: amount,
          },
          [
            {
              description: currentRequest.serviceName ?? currentRequest.serviceCategory,
              quantity: 1,
              unitPrice: amount,
              category: 'laboratory',
            },
          ],
        );

        createdInvoiceId = createdInvoice.id;

        // Keep financial records linked to the exact lab request that was paid.
        if (isSupabaseConfigured && supabase) {
          const { error: linkError } = await supabase
            .from('invoices')
            .update({ service_request_id: currentRequest.id } as never)
            .eq('id', createdInvoice.id);

          if (linkError) {
            if (!isMissingInvoiceServiceRequestColumnError(linkError)) {
              throw linkError;
            }
          }
        }

        const updatedRequest = await labRequestService.markRequestAsPaid(currentRequest.id, invoiceNumber);
        return { request: updatedRequest ?? currentRequest, invoiceNumber, invoiceId: createdInvoice.id };
      } catch (error) {
        if (createdInvoiceId) {
          await deleteInvoiceLiveOrDemo(createdInvoiceId).catch(() => undefined);
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      const paidRequest = {
        ...result.request,
        paymentStatus: 'paid' as const,
        receiptCode: result.invoiceNumber ?? result.request.receiptCode,
      };

      qc.setQueryData(queryKeys.labRequest(result.request.id), paidRequest);
      if (submittedRequestId && submittedRequestId !== result.request.id) {
        qc.setQueryData(queryKeys.labRequest(submittedRequestId), paidRequest);
      }

      await qc.invalidateQueries({ queryKey: queryKeys.invoices });
      await qc.invalidateQueries({ queryKey: queryKeys.invoiceItems });
      await qc.invalidateQueries({ queryKey: queryKeys.labRequest(result.request.id) });
      await qc.invalidateQueries({ queryKey: ['lab-queue'] });
      setSubmittedRequestId(result.request.id);
      setValue(result.request.id);
      setLinkedInvoice({
        requestId: result.request.id,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
      });
      toast.success(result.invoiceNumber ? `Payment recorded. Billing record ${result.invoiceNumber} created.` : 'Payment already recorded.');
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, 'Unable to record payment for this laboratory request.'));
    },
  });

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
    setLinkedInvoice(null);
    setAutoProcessRedirectedRequestId(null);
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
          Laboratory and clinic staff can scan the patient QR receipt or enter Request ID, INV-LAB, and ODC-LAB codes to verify and process requests.
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
            <span className="mb-2 block text-sm font-medium text-slate-700">Receipt QR link, request id, or receipt code</span>
            <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <QrCode className="size-5 text-slate-400" />
              <Input
                className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                onChange={(event) => setValue(event.target.value)}
                placeholder="Paste scanned lab receipt result (e.g., ODC-LAB-XXXX)"
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
        <CardTitle className="mt-2">Laboratory payment status</CardTitle>
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
                <Badge intent={request.paymentStatus === 'paid' ? 'success' : 'warning'}>
                  {request.paymentStatus === 'paid' ? 'Paid' : 'Pending Cashier'}
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
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Service status</p>
                  <p className="mt-1 font-semibold text-slate-950">{request.status}</p>
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

            <div className={isPaid
              ? 'rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
              : 'rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900'}
            >
              {isPaid
                ? 'Payment has already been recorded for this service. The patient can proceed to the laboratory workflow.'
                : 'Payment is still pending. Laboratory processing is blocked until billing marks this request as paid.'}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Receipt code</p>
                  <p className="mt-1 font-mono font-semibold text-slate-950">{request.receiptCode ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Payment status</p>
                  <p className="mt-1 font-semibold text-slate-950">{request.paymentStatus}</p>
                </div>
              </div>
            </div>

            {linkedInvoice && linkedInvoice.requestId === request.id ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                <p className="text-xs font-extrabold uppercase tracking-widest text-sky-700">Linked billing record</p>
                <p className="mt-2 font-semibold">Invoice number: {linkedInvoice.invoiceNumber ?? request.receiptCode ?? 'N/A'}</p>
                <p className="mt-1 text-xs text-sky-800">Invoice ID: {linkedInvoice.invoiceId ?? 'Already linked before this action'}</p>
                {linkedInvoice.invoiceId ? (
                  <Link
                    className="mt-3 inline-flex items-center justify-center rounded-none border border-sky-200 bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-sky-700 transition hover:bg-sky-100"
                    to={`/app/billing?invoiceId=${encodeURIComponent(linkedInvoice.invoiceId)}`}
                  >
                    View in billing
                  </Link>
                ) : null}
              </div>
            ) : null}

            {canMarkPaid && !isPaid ? (
              <Button className="w-full gap-2" disabled={markPaid.isPending} onClick={() => void markPaid.mutateAsync(request.id)} type="button">
                <ScanLine className="size-4" />
                {markPaid.isPending ? 'Recording payment...' : 'Mark paid and issue billing record'}
              </Button>
            ) : null}

            {!canMarkPaid ? (
              <p className="text-sm text-slate-500">This view is read-only for staff without cashier billing permission.</p>
            ) : null}

            {canOpenLaboratory && isPaid ? (
              <Link to={`/app/laboratory?request=${encodeURIComponent(request.id)}`}>
                <Button className="w-full gap-2" type="button">
                  <ScanLine className="size-4" />
                  {canProcessLaboratory ? 'Process Lab Request' : 'Open laboratory page'}
                </Button>
              </Link>
            ) : canOpenLaboratory ? (
              <Button className="w-full gap-2" type="button" disabled>
                <ScanLine className="size-4" />
                Open request in laboratory workflow
              </Button>
            ) : (
              <p className="text-sm text-slate-500">This account can verify the paid request here, but does not have laboratory page access.</p>
            )}

          </div>
        )}
      </Card>
    </div>
  );
}
