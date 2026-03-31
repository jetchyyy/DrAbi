import { AlertCircle, LoaderCircle, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Card, CardTitle } from '../../components/ui/card';
import { formatDateTimeLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useAuthorizedTeleconsultAppointment } from './hooks/use-teleconsult';

type ScriptState = 'loading' | 'ready' | 'error';
type JitsiApiHandle = { dispose: () => void };

function loadJitsiScript(onReady: () => void, onError: () => void) {
  if (window.JitsiMeetExternalAPI) {
    onReady();
    return () => undefined;
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-jitsi-external-api="true"]');
  if (existing) {
    existing.addEventListener('load', onReady);
    existing.addEventListener('error', onError);

    return () => {
      existing.removeEventListener('load', onReady);
      existing.removeEventListener('error', onError);
    };
  }

  const script = document.createElement('script');
  script.src = 'https://meet.jit.si/external_api.js';
  script.async = true;
  script.dataset.jitsiExternalApi = 'true';
  script.addEventListener('load', onReady);
  script.addEventListener('error', onError);
  document.body.appendChild(script);

  return () => {
    script.removeEventListener('load', onReady);
    script.removeEventListener('error', onError);
  };
}

export function TeleconsultRoomPage() {
  const { appointmentId = '' } = useParams();
  const { profile } = useAuth();
  const { data: appointment, isLoading } = useAuthorizedTeleconsultAppointment(appointmentId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<JitsiApiHandle | null>(null);
  const [scriptState, setScriptState] = useState<ScriptState>('loading');

  useEffect(() => {
    setScriptState('loading');
    return loadJitsiScript(
      () => setScriptState('ready'),
      () => setScriptState('error'),
    );
  }, []);

  useEffect(() => {
    if (!appointment || !profile || scriptState !== 'ready' || !containerRef.current || !window.JitsiMeetExternalAPI) {
      return undefined;
    }

    apiRef.current?.dispose();
    apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: appointment.roomName,
      parentNode: containerRef.current,
      width: '100%',
      height: '100%',
      userInfo: {
        displayName: profile.fullName,
        email: profile.email,
      },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        MOBILE_APP_PROMO: false,
        SHOW_JITSI_WATERMARK: false,
      },
    });

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [appointment, profile, scriptState]);

  const backPath = profile?.role === 'patient' ? '/portal/my-bookings' : '/app/appointments';

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-3 text-slate-500">
          <LoaderCircle className="size-5 animate-spin" />
          Loading teleconsult room...
        </div>
      </Card>
    );
  }

  if (!appointment || !profile || (profile.role !== 'patient' && profile.role !== 'doctor')) {
    return (
      <Card className="p-8">
        <div className="flex items-start gap-3 text-slate-600">
          <AlertCircle className="mt-0.5 size-5 text-amber-500" />
          <div>
            <CardTitle>Teleconsult access unavailable</CardTitle>
            <p className="mt-2 text-sm">
              This room is only available to the assigned patient and doctor on the teleconsult appointment.
            </p>
            <Link className="mt-4 inline-flex text-sm font-semibold text-[var(--color-primary)]" to={backPath}>
              Return to schedule
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.34fr_1fr]">
      <Card className="h-fit">
        <Badge intent="info">Secure teleconsult</Badge>
        <CardTitle className="mt-4 text-2xl">{appointment.serviceName}</CardTitle>
        <p className="mt-3 text-sm text-slate-500">{formatDateTimeLabel(appointment.scheduledAt)}</p>
        <div className="mt-5 space-y-3 text-sm text-slate-600">
          <p>
            <span className="font-semibold text-slate-950">Doctor:</span> {appointment.doctorName}
          </p>
          <p>
            <span className="font-semibold text-slate-950">Patient:</span> {appointment.patientName}
          </p>
          <p>
            <span className="font-semibold text-slate-950">Platform:</span> {appointment.teleconsultationPlatform}
          </p>
          <p>
            <span className="font-semibold text-slate-950">Notes:</span> {appointment.teleconsultationAccessInstructions}
          </p>
        </div>
        <Link className="mt-5 inline-flex text-sm font-semibold text-[var(--color-primary)]" to={backPath}>
          Back to appointments
        </Link>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-3 text-white">
              <Video className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-950">In-app teleconsult room</p>
              <p className="text-sm text-slate-500">Only authenticated participants assigned to this appointment can enter.</p>
            </div>
          </div>
          <Badge>{appointment.status.replace('_', ' ')}</Badge>
        </div>

        {scriptState === 'error' ? (
          <div className="p-6 text-sm text-rose-600">Unable to load the video component. Please refresh and try again.</div>
        ) : (
          <div className="h-[72vh] min-h-[560px] bg-slate-950">
            <div className="h-full w-full" ref={containerRef} />
          </div>
        )}
      </Card>
    </div>
  );
}
