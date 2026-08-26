import { AlertCircle, LoaderCircle, Video, Mic, MicOff, VideoOff, PhoneOff, Users, Award, FileText, Pill, Printer, X } from 'lucide-react';
import {
  usePatientConsultations,
  usePatientPrescriptions,
  usePatientMedicalCertificates,
  usePatientDetail,
} from '../patients/hooks/use-patients';
import { useClinicSettingsData, useProviderDirectory } from '../../hooks/use-clinic-data';
import { printHtmlDocument } from '../../lib/print';
import { buildPrescriptionPrintDocument } from '../patients/prescription-print-document';
import { buildMedicalCertificatePrintDocument } from '../patients/medical-certificate-print-document';
import { formatDateLabel } from '../../lib/utils';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RealtimeChannel } from '@supabase/supabase-js';

import { Badge } from '../../components/ui/badge';
import { Card, CardTitle } from '../../components/ui/card';
import { formatDateTimeLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useAuthorizedTeleconsultAppointment } from './hooks/use-teleconsult';
import { supabase } from '../../lib/supabase';
import { TeleconsultDoctorPanel } from './teleconsult-doctor-panel';

type ScriptState = 'loading' | 'ready' | 'error';
type JitsiApiHandle = { dispose: () => void };
type CallState = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';

interface Peer {
  id: string;
  name: string;
  role: string;
  peerConnection: RTCPeerConnection;
  stream?: MediaStream;
}

const iceServers: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

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
  const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';
  script.src = `https://${jitsiDomain}/external_api.js`;
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

function VideoStream({ stream, muted = false, className = '' }: { stream: MediaStream; muted?: boolean; className?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={className}
      style={{ transform: muted ? 'scaleX(-1)' : 'none' }}
    />
  );
}

export function TeleconsultRoomPage() {
  const { appointmentId = '' } = useParams();
  const { profile } = useAuth();
  const { data: appointment, isLoading } = useAuthorizedTeleconsultAppointment(appointmentId);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [docPreviewModal, setDocPreviewModal] = useState<{ open: boolean; title: string; html: string; isPrinting: boolean }>({
    open: false, title: "", html: "", isPrinting: false,
  });

  const isDoctor = profile?.role === 'doctor';

  const { data: patient } = usePatientDetail(!isDoctor && appointment?.patientId ? appointment.patientId : null);
  const { data: consultations = [] } = usePatientConsultations(!isDoctor && appointment?.patientId ? appointment.patientId : null, { refetchInterval: 3000 });
  const { data: prescriptions = [] } = usePatientPrescriptions(!isDoctor && appointment?.patientId ? appointment.patientId : null, { refetchInterval: 3000 });
  const { data: certificates = [] } = usePatientMedicalCertificates(!isDoctor && appointment?.patientId ? appointment.patientId : null, { refetchInterval: 3000 });
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: providers = [] } = useProviderDirectory();

  const clinicInfo = {
    clinicName: clinicSettings?.clinicName ?? "Clinic",
    clinicAddress: clinicSettings?.address ?? "",
    clinicContactNumber: clinicSettings?.contactNumber ?? "",
    clinicEmail: clinicSettings?.email ?? "",
  };

  const parsePrescriptionDisplayName = (value: string) => {
    const text = (value ?? "").trim();
    const match = text.match(/^(.*?)(?:\s*\(Brand:\s*(.*?)\))?$/i);
    if (!match) return { genericName: text, brandName: "" };
    return {
      genericName: (match[1] ?? "").trim(),
      brandName: (match[2] ?? "").trim(),
    };
  };

  const formatDoctorDisplayName = (name: string | null | undefined, postNominals?: string | null) => {
    const baseName = (name ?? "").trim().replace(/^dr\.?\s+/i, "").trim();
    if (!baseName) return "Attending Physician";
    const suffix = (postNominals ?? "").trim();
    return suffix ? `${baseName} ${suffix}` : baseName;
  };

  const resolveDoctorPostNominals = (input: { linkedDoctorTitle?: string | null }) => {
    return (input.linkedDoctorTitle ?? "").trim();
  };

  const buildDocDoctorInfo = (consultationId: string | null | undefined) => {
    const linkedConsultation = consultations.find((c) => c.id === consultationId) ?? null;
    const linkedDoctor = linkedConsultation
      ? providers.find((p) => p.id === linkedConsultation.doctorId || p.profileId === linkedConsultation.doctorId)
      : null;
    const doctorNameRaw =
      linkedDoctor?.fullName ??
      linkedConsultation?.providerName ??
      appointment?.doctorName ??
      "Attending Physician";
    const doctorPostNominals = resolveDoctorPostNominals({
      linkedDoctorTitle: linkedDoctor?.title ?? null,
    });
    const doctorName = formatDoctorDisplayName(doctorNameRaw, doctorPostNominals);
    const doctorSpecialty = linkedDoctor?.specialtyName ?? "Physician";
    const doctorLicenseNumber = linkedDoctor?.licenseNumber ?? "";
    const doctorBirNumber = linkedDoctor?.birNumber ?? "";
    const doctorPtrNumber = linkedDoctor?.ptrNumber ?? "";
    const prcLicense = (doctorLicenseNumber || "").replace(/\s+/g, "").toUpperCase();
    const doctorPrcQrData = prcLicense ? `https://www.prc.gov.ph/licensee?id=${encodeURIComponent(prcLicense)}&type=PRC` : "";

    return {
      linkedConsultation,
      doctorName,
      doctorSpecialty,
      doctorLicenseNumber,
      doctorBirNumber,
      doctorPtrNumber,
      doctorPrcQrData,
    };
  };

  const buildPatientAge = (birthDate?: string | null) => {
    if (!birthDate) return "";
    const today = new Date();
    const birth = new Date(birthDate);
    return String(today.getFullYear() - birth.getFullYear() - (today < new Date(birth.setFullYear(today.getFullYear())) ? 1 : 0));
  };

  const buildAndOpenPrescriptionDoc = (rxList: any[]) => {
    if (rxList.length === 0) return;
    const { doctorName, doctorSpecialty, doctorLicenseNumber, doctorBirNumber, doctorPtrNumber, doctorPrcQrData, linkedConsultation } =
      buildDocDoctorInfo(rxList[0].consultationId);
    const nextAppointment = linkedConsultation
      ? `${linkedConsultation.consultationDate} ${linkedConsultation.consultationTime}`
      : "";
    const html = buildPrescriptionPrintDocument({
      ...clinicInfo,
      doctorName,
      doctorSpecialty,
      doctorLicenseNumber,
      doctorBirNumber,
      doctorPtrNumber,
      doctorPrcQrData,
      patientName: appointment?.patientName ?? "Patient",
      patientAge: buildPatientAge(patient?.birthDate),
      patientSex: patient?.sex ?? "other",
      patientAddress: patient?.address ?? "",
      issuedDate: rxList[0].createdAt,
      nextAppointment,
      medications: rxList.map((rx) => ({
        name: parsePrescriptionDisplayName(rx.prescriptionName).genericName || rx.prescriptionName,
        brandName: (rx.brandName ?? "").trim() || parsePrescriptionDisplayName(rx.prescriptionName).brandName,
        dosage: rx.dosage,
        instruction: rx.instruction,
        numberOfMedications:
          rx.numberOfMedications == null ? undefined : `${rx.numberOfMedications}`,
      })),
    });
    setDocPreviewModal({ open: true, title: "Prescription", html, isPrinting: false });
  };

  const buildAndOpenMedCertDoc = async (cert: any) => {
    const { doctorName, doctorSpecialty, doctorLicenseNumber, doctorBirNumber, doctorPtrNumber, doctorPrcQrData } =
      buildDocDoctorInfo(cert.consultationId);
    let patientQrSvg = "";
    try {
      if (patient?.qrCode) {
        patientQrSvg = await QRCode.toString(patient.qrCode, {
          errorCorrectionLevel: "M",
          margin: 1,
          type: "svg",
          width: 120,
        });
      }
    } catch (err) {
      console.error(err);
    }
    const html = buildMedicalCertificatePrintDocument({
      ...clinicInfo,
      certificateNumber:
        cert.certificateNumber != null ? String(cert.certificateNumber) : "",
      patientQrSvg,
      patientQrCode: patient?.qrCode ?? "",
      patientReferenceCode: patient?.id ?? "",
      doctorName,
      doctorSpecialty,
      doctorLicenseNumber,
      doctorBirNumber,
      doctorPtrNumber,
      doctorPrcQrData,
      patientName: appointment?.patientName ?? "Patient",
      patientAge: buildPatientAge(patient?.birthDate),
      patientSex: patient?.sex ?? "other",
      patientAddress: patient?.address ?? "",
      issuedDate: cert.createdAt,
      certificatePurpose: cert.certificatePurpose,
      diagnosis: cert.diagnosis,
      recommendation: cert.recommendation,
      restFrom: cert.restFrom ?? "",
      restUntil: cert.restUntil ?? "",
      checkFinancial: cert.checkFinancial ?? false,
      checkSchool: cert.checkSchool ?? false,
      checkWork: cert.checkWork ?? false,
    });
    setDocPreviewModal({ open: true, title: "Medical Certificate", html, isPrinting: false });
  };

  const handlePrintModalDoc = async () => {
    if (!docPreviewModal.html) return;
    setDocPreviewModal((prev) => ({ ...prev, isPrinting: true }));
    try {
      await printHtmlDocument(docPreviewModal.html);
    } finally {
      setDocPreviewModal((prev) => ({ ...prev, isPrinting: false }));
    }
  };

  const linkedConsultation = consultations.find((c: any) => c.appointmentId === appointment?.id) ?? null;
  const rxList = linkedConsultation ? prescriptions.filter((rx: any) => rx.consultationId === linkedConsultation.id) : [];
  const certList = linkedConsultation ? certificates.filter((c: any) => c.consultationId === linkedConsultation.id) : [];
  
  // Config Mode
  const teleconsultMode = import.meta.env.VITE_TELECONSULT_MODE || 'custom_webrtc';
  const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';

  // Jitsi States
  const apiRef = useRef<JitsiApiHandle | null>(null);
  const [scriptState, setScriptState] = useState<ScriptState>('loading');

  // WebRTC States
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localVideoActive, setLocalVideoActive] = useState(true);
  const [localAudioActive, setLocalAudioActive] = useState(true);
  const [peers, setPeers] = useState<{ [peerId: string]: Peer }>({});

  // WebRTC Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingCandidatesRef = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});

  // ── JITSI EFFECT ──
  useEffect(() => {
    if (teleconsultMode !== 'jitsi') return;

    setScriptState('loading');
    return loadJitsiScript(
      () => setScriptState('ready'),
      () => setScriptState('error'),
    );
  }, [teleconsultMode]);

  useEffect(() => {
    if (teleconsultMode !== 'jitsi' || !appointment || !profile || scriptState !== 'ready' || !containerRef.current || !window.JitsiMeetExternalAPI) {
      return undefined;
    }

    apiRef.current?.dispose();
    apiRef.current = new window.JitsiMeetExternalAPI(jitsiDomain, {
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
  }, [appointment, profile, scriptState, teleconsultMode, jitsiDomain]);

  // ── WEBRTC EFFECTS & HANDLERS ──
  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCallState('idle');
    } catch (err) {
      console.error("Failed to get local camera/mic stream:", err);
      setCallState('error');
    }
  };

  useEffect(() => {
    if (teleconsultMode === 'custom_webrtc') {
      startPreview();
    }
    return () => {
      // Cleanup local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      // Cleanup connections
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
      // Cleanup channels
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [teleconsultMode]);

  const handlePeerLeave = (peerId: string) => {
    const pc = peerConnectionsRef.current[peerId];
    if (pc) {
      pc.close();
      delete peerConnectionsRef.current[peerId];
    }
    setPeers(prev => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const joinCall = () => {
    if (!appointment || !profile || !localStreamRef.current) return;
    if (!supabase) {
      console.error("Supabase client is not initialized.");
      return;
    }

    setCallState('connected');

    const channel = supabase.channel(`teleconsult-room-${appointment.id}`, {
      config: {
        broadcast: { self: false },
      },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'join' }, async ({ payload }) => {
        const { peerId, name, role } = payload;
        console.log("Peer joined session:", peerId, name, role);

        if (peerConnectionsRef.current[peerId]) {
          peerConnectionsRef.current[peerId].close();
        }

        const pc = new RTCPeerConnection(iceServers);
        peerConnectionsRef.current[peerId] = pc;

        localStreamRef.current?.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: {
                senderId: profile.id,
                targetId: peerId,
                candidate: event.candidate,
              },
            });
          }
        };

        pc.ontrack = (event) => {
          console.log("Received remote track from peer:", peerId);
          setPeers(prev => ({
            ...prev,
            [peerId]: {
              ...prev[peerId],
              stream: event.streams[0]
            }
          }));
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            handlePeerLeave(peerId);
          }
        };

        // Existing user generates offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        channel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            senderId: profile.id,
            targetId: peerId,
            name: profile.fullName,
            role: profile.role,
            sdp: offer,
          },
        });

        setPeers(prev => ({
          ...prev,
          [peerId]: {
            id: peerId,
            name,
            role,
            peerConnection: pc
          }
        }));
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        const { senderId, targetId, name, role, sdp } = payload;
        if (targetId !== profile.id) return;

        console.log("Received offer from initiator:", senderId);

        if (peerConnectionsRef.current[senderId]) {
          peerConnectionsRef.current[senderId].close();
        }

        const pc = new RTCPeerConnection(iceServers);
        peerConnectionsRef.current[senderId] = pc;

        localStreamRef.current?.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: {
                senderId: profile.id,
                targetId: senderId,
                candidate: event.candidate,
              },
            });
          }
        };

        pc.ontrack = (event) => {
          console.log("Received remote track from sender:", senderId);
          setPeers(prev => ({
            ...prev,
            [senderId]: {
              ...prev[senderId],
              stream: event.streams[0]
            }
          }));
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            handlePeerLeave(senderId);
          }
        };

        setPeers(prev => ({
          ...prev,
          [senderId]: {
            id: senderId,
            name,
            role,
            peerConnection: pc
          }
        }));

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        
        // Add any queued ICE candidates for this peer
        const pending = pendingCandidatesRef.current[senderId] || [];
        for (const cand of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.error("Failed to add queued ice candidate:", e);
          }
        }
        delete pendingCandidatesRef.current[senderId];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channel.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            senderId: profile.id,
            targetId: senderId,
            name: profile.fullName,
            role: profile.role,
            sdp: answer,
          },
        });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        const { senderId, targetId, sdp } = payload;
        if (targetId !== profile.id) return;

        console.log("Received answer from receiver:", senderId);
        const pc = peerConnectionsRef.current[senderId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          
          // Add any queued ICE candidates for this peer
          const pending = pendingCandidatesRef.current[senderId] || [];
          for (const cand of pending) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.error("Failed to add queued ice candidate:", e);
            }
          }
          delete pendingCandidatesRef.current[senderId];
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        const { senderId, targetId, candidate } = payload;
        if (targetId !== profile.id) return;

        const pc = peerConnectionsRef.current[senderId];
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("Failed to add ice candidate:", e);
          }
        } else {
          if (!pendingCandidatesRef.current[senderId]) {
            pendingCandidatesRef.current[senderId] = [];
          }
          pendingCandidatesRef.current[senderId].push(candidate);
        }
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        const { peerId } = payload;
        console.log("Peer left conversation:", peerId);
        handlePeerLeave(peerId);
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("Signaling channel ready. Broadcasting join metadata...");
        channel.send({
          type: 'broadcast',
          event: 'join',
          payload: {
            peerId: profile.id,
            name: profile.fullName,
            role: profile.role,
          },
        });
      }
    });
  };

  const leaveCall = () => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'leave',
        payload: {
          peerId: profile?.id,
        },
      });
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    setPeers({});
    setCallState('idle');
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setLocalVideoActive(videoTracks[0]?.enabled ?? false);
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setLocalAudioActive(audioTracks[0]?.enabled ?? false);
    }
  };

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
    <div className={`grid gap-5 ${isDoctor ? 'xl:grid-cols-[1fr_460px]' : 'xl:grid-cols-[1fr_360px]'}`}>

      {/* ── VIDEO PANEL ── */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl p-2.5"
              style={{
                background: 'color-mix(in srgb, var(--color-primary) 14%, white)',
                color: 'var(--color-primary)',
              }}
            >
              <Video className="size-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-950">Video Consultation</p>
              <p className="text-xs text-slate-400">
                {appointment.serviceName} &bull; {formatDateTimeLabel(appointment.scheduledAt)}
              </p>
            </div>
          </div>
          <Badge>{appointment.status.replace('_', ' ')}</Badge>
        </div>

        {/* ── JITSI VIEW ── */}
        {teleconsultMode === 'jitsi' && (
          scriptState === 'error' ? (
            <div className="p-6 text-sm text-rose-600">Unable to load the video component — please refresh and try again</div>
          ) : (
            <div className="h-[70vh] min-h-[520px] bg-slate-100">
              <div className="h-full w-full" ref={containerRef} />
            </div>
          )
        )}

        {/* ── WEBRTC VIEW ── */}
        {teleconsultMode === 'custom_webrtc' && (
          <div className="relative flex flex-col" style={{ height: '70vh', minHeight: '520px' }}>
            {/* Idle / preview */}
            {callState === 'idle' && (
              <div className="flex flex-1 flex-col items-center justify-center bg-white p-6 text-center">
                <div className="relative mb-5 aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-lg">
                  {localStream && localVideoActive ? (
                    <VideoStream stream={localStream} muted className="h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                      <VideoOff className="mb-2 size-10" />
                      <p className="text-xs">Camera is off</p>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
                    <button
                      onClick={toggleAudio}
                      className={`rounded-full p-2 shadow-md transition-colors ${localAudioActive ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                    >
                      {localAudioActive ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                    </button>
                    <button
                      onClick={toggleVideo}
                      className={`rounded-full p-2 shadow-md transition-colors ${localVideoActive ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                    >
                      {localVideoActive ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900">Ready to join?</h3>
                <p className="mt-1 max-w-xs text-xs text-slate-500">Check your camera and mic before joining the call</p>

                <button
                  onClick={joinCall}
                  className="mt-5 flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all active:scale-95 hover:brightness-95"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    boxShadow: '0 8px 20px -6px color-mix(in srgb, var(--color-primary) 50%, transparent)',
                  }}
                >
                  <Video className="size-4" />
                  Join Call
                </button>
              </div>
            )}

            {/* Connected */}
            {callState === 'connected' && (
              <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-slate-100">
                <div className="flex-1 grid gap-4 overflow-y-auto p-4 items-center justify-center grid-cols-1 md:grid-cols-2">
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-md">
                    {localStream && localVideoActive ? (
                      <VideoStream stream={localStream} muted className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                        <VideoOff className="mb-2 size-10" />
                        <p className="text-xs">Camera off</p>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                      <span>{profile.fullName} (You)</span>
                      {!localAudioActive && <MicOff className="size-3 text-rose-400" />}
                    </div>
                  </div>
                  {Object.values(peers).map((peer) => (
                    <div key={peer.id} className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-md">
                      {peer.stream ? (
                        <VideoStream stream={peer.stream} className="h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                          <LoaderCircle className="mb-2 size-8 animate-spin" />
                          <p className="text-xs font-semibold">Connecting to {peer.name}</p>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold capitalize text-white backdrop-blur-md">
                        {peer.name}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur-md">
                  <Users className="size-3" style={{ color: 'var(--color-primary)' }} />
                  <span>{Object.keys(peers).length + 1} in call</span>
                </div>

                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-6 py-2.5 shadow-xl backdrop-blur-md">
                  <button
                    onClick={toggleAudio}
                    className={`rounded-full p-2.5 transition-colors ${localAudioActive ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                  >
                    {localAudioActive ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                  </button>
                  <button
                    onClick={toggleVideo}
                    className={`rounded-full p-2.5 transition-colors ${localVideoActive ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                  >
                    {localVideoActive ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                  </button>
                  <div className="mx-1 h-5 w-px bg-slate-200" />
                  <button
                    onClick={leaveCall}
                    className="rounded-full bg-rose-600 p-2.5 text-white shadow-md transition-all hover:bg-rose-700 active:scale-95"
                  >
                    <PhoneOff className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {callState === 'error' && (
              <div className="flex flex-1 flex-col items-center justify-center bg-white p-6 text-center">
                <AlertCircle className="mb-4 size-12 text-rose-500" />
                <h3 className="text-base font-bold text-slate-900">Camera access required</h3>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Allow camera and microphone access in your browser then try again
                </p>
                <button
                  onClick={startPreview}
                  className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── RIGHT COLUMN: appointment info + clinical panel ── */}
      <div className="flex flex-col gap-4">
        {/* Compact appointment info */}
        <Card className="h-fit">
          <div className="mb-3 flex items-center justify-between">
            <Badge intent="info">Teleconsultation</Badge>
            <Link className="text-xs font-semibold text-slate-400 hover:text-[var(--color-primary)]" to={backPath}>
              ← Back
            </Link>
          </div>
          <p className="text-base font-bold text-slate-950">{appointment.serviceName}</p>
          <p className="mt-0.5 text-xs text-slate-400">{formatDateTimeLabel(appointment.scheduledAt)}</p>
          <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Doctor</span>
              <span className="font-medium text-slate-800">{appointment.doctorName}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Patient</span>
              <span className="font-medium text-slate-800">{appointment.patientName}</span>
            </div>
            {appointment.teleconsultationAccessInstructions && (
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                {appointment.teleconsultationAccessInstructions}
              </div>
            )}
          </div>
        </Card>

        {/* Clinical panel — doctor only */}
        {isDoctor && (
          <TeleconsultDoctorPanel appointment={appointment} />
        )}

        {/* Patient Documents Panel (Real-Time) */}
        {!isDoctor && linkedConsultation && (rxList.length > 0 || certList.length > 0) && (
          <Card className="h-fit space-y-4 border-slate-200/80 bg-white shadow-md">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="size-4 text-orange-600" />
              Clinical Documents
            </CardTitle>
            <p className="text-xs text-slate-500 leading-relaxed -mt-2">
              View or print/save official documents issued during this teleconsultation.
            </p>

            {/* Prescriptions */}
            {rxList.length > 0 && (
              <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 animate-fade-up">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pill className="size-3.5 text-violet-600" />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-700">Prescription</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-50 transition-colors shadow-sm"
                    onClick={() => buildAndOpenPrescriptionDoc(rxList)}
                  >
                    <Printer className="size-3" /> View &amp; Print
                  </button>
                </div>
                <div className="space-y-2.5">
                  {rxList.map((rx: any) => (
                    <div key={rx.id} className="text-xs">
                      <p className="font-bold text-slate-800">
                        {rx.prescriptionName}
                        {rx.brandName ? <span className="ml-1 font-normal text-slate-500">({rx.brandName})</span> : null}
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        {rx.dosage} &mdash; {rx.instruction}
                        {rx.numberOfMedications ? ` · Qty: ${rx.numberOfMedications}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Medical Certificates */}
            {certList.length > 0 && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 animate-fade-up">
                <div className="space-y-3">
                  {certList.map((cert: any) => (
                    <div key={cert.id} className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="size-3.5 text-emerald-600" />
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Medical Certificate</span>
                        </div>
                        <p className="font-bold text-slate-800 leading-tight">{cert.certificatePurpose}</p>
                        {cert.diagnosis && <p className="text-slate-600 mt-1">Diagnosis: {cert.diagnosis}</p>}
                        {cert.restUntil && (
                          <p className="font-semibold text-emerald-700 mt-1">
                            Rest recommended until: {formatDateLabel(cert.restUntil)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors shadow-sm"
                        onClick={() => { void buildAndOpenMedCertDoc(cert); }}
                      >
                        <Printer className="size-3" /> View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {docPreviewModal.open && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm animate-fade-in"
          onClick={() => setDocPreviewModal((prev) => ({ ...prev, open: false }))}
          role="dialog"
        >
          <div
            className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                {docPreviewModal.title}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  disabled={docPreviewModal.isPrinting}
                  onClick={() => { void handlePrintModalDoc(); }}
                  type="button"
                >
                  <Printer className="size-3.5" />
                  {docPreviewModal.isPrinting ? "Printing..." : "Print"}
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-100"
                  onClick={() => setDocPreviewModal((prev) => ({ ...prev, open: false }))}
                  type="button"
                  aria-label="Close document preview"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <iframe
              className="h-full w-full border-0 bg-white"
              srcDoc={docPreviewModal.html}
              title={docPreviewModal.title || "Document preview"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
