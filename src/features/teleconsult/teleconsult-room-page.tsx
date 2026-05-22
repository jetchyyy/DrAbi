import { AlertCircle, LoaderCircle, Video, Mic, MicOff, VideoOff, PhoneOff, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RealtimeChannel } from '@supabase/supabase-js';

import { Badge } from '../../components/ui/badge';
import { Card, CardTitle } from '../../components/ui/card';
import { formatDateTimeLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useAuthorizedTeleconsultAppointment } from './hooks/use-teleconsult';
import { supabase } from '../../lib/supabase';

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
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        const { senderId, targetId, candidate } = payload;
        if (targetId !== profile.id) return;

        const pc = peerConnectionsRef.current[senderId];
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
            <span className="font-semibold text-slate-950">Platform:</span> {teleconsultMode === 'custom_webrtc' ? 'In-house Secure Call' : appointment.teleconsultationPlatform}
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
              <p className="font-semibold text-slate-950">
                {teleconsultMode === 'custom_webrtc' ? 'In-house Secure Call' : 'In-app teleconsult room'}
              </p>
              <p className="text-sm text-slate-500">
                {teleconsultMode === 'custom_webrtc' 
                  ? 'Private, peer-to-peer encrypted connection.' 
                  : 'Only authenticated participants assigned to this appointment can enter.'}
              </p>
            </div>
          </div>
          <Badge>{appointment.status.replace('_', ' ')}</Badge>
        </div>

        {/* ── JITSI VIEW ── */}
        {teleconsultMode === 'jitsi' && (
          scriptState === 'error' ? (
            <div className="p-6 text-sm text-rose-600">Unable to load the video component. Please refresh and try again.</div>
          ) : (
            <div className="h-[72vh] min-h-[560px] bg-slate-950">
              <div className="h-full w-full" ref={containerRef} />
            </div>
          )
        )}

        {/* ── CUSTOM WEBRTC VIEW ── */}
        {teleconsultMode === 'custom_webrtc' && (
          <div className="h-[72vh] min-h-[560px] bg-slate-950 relative flex flex-col">
            {callState === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-white text-center">
                <div className="relative w-full max-w-sm aspect-video bg-slate-900 border border-slate-800 rounded-lg overflow-hidden mb-6 shadow-2xl flex items-center justify-center">
                  {localStream && localVideoActive ? (
                    <VideoStream stream={localStream} muted className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                      <VideoOff className="size-12 mb-2" />
                      <p className="text-xs">Camera is off</p>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
                    <button
                      onClick={toggleAudio}
                      className={`p-2 rounded-full transition-colors shadow-md ${
                        localAudioActive ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                      title={localAudioActive ? 'Mute Mic' : 'Unmute Mic'}
                    >
                      {localAudioActive ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                    </button>
                    <button
                      onClick={toggleVideo}
                      className={`p-2 rounded-full transition-colors shadow-md ${
                        localVideoActive ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                      title={localVideoActive ? 'Turn Camera Off' : 'Turn Camera On'}
                    >
                      {localVideoActive ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold mb-1">Ready to join your consultation?</h3>
                <p className="text-xs text-slate-400 max-w-xs mb-6">
                  Check your camera and microphone preview before starting the secure in-house call.
                </p>

                <button
                  onClick={joinCall}
                  className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-150 shadow-lg flex items-center gap-2"
                >
                  <Video className="size-4 animate-pulse" />
                  Join Secure Call
                </button>
              </div>
            )}

            {callState === 'connected' && (
              <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                {/* Responsive Grid */}
                <div className="flex-1 p-4 grid gap-4 overflow-y-auto items-center justify-center grid-cols-1 md:grid-cols-2">
                  {/* Local feed */}
                  <div className="relative aspect-video w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-md">
                    {localStream && localVideoActive ? (
                      <VideoStream stream={localStream} muted className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                        <VideoOff className="size-10 mb-2" />
                        <p className="text-xs">Your camera is off</p>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-slate-950/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 border border-slate-800">
                      <span>{profile.fullName} (You)</span>
                      {!localAudioActive && <MicOff className="size-3 text-rose-500" />}
                    </div>
                  </div>

                  {/* Remote feeds */}
                  {Object.values(peers).map((peer) => (
                    <div key={peer.id} className="relative aspect-video w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-md">
                      {peer.stream ? (
                        <VideoStream stream={peer.stream} className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                          <LoaderCircle className="size-8 animate-spin mb-2" />
                          <p className="text-xs font-semibold">Connecting to {peer.name}...</p>
                          <p className="text-[10px] text-slate-500 capitalize">{peer.role}</p>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 bg-slate-950/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 border border-slate-800">
                        <span className="capitalize">{peer.name} ({peer.role})</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Floating control bar */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-slate-900/95 backdrop-blur-md border border-slate-800 px-6 py-2.5 rounded-full shadow-2xl z-20">
                  <button
                    onClick={toggleAudio}
                    className={`p-2.5 rounded-full transition-colors ${
                      localAudioActive ? 'bg-slate-850 hover:bg-slate-800 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                    title={localAudioActive ? 'Mute Mic' : 'Unmute Mic'}
                  >
                    {localAudioActive ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                  </button>
                  <button
                    onClick={toggleVideo}
                    className={`p-2.5 rounded-full transition-colors ${
                      localVideoActive ? 'bg-slate-850 hover:bg-slate-800 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                    title={localVideoActive ? 'Turn Camera Off' : 'Turn Camera On'}
                  >
                    {localVideoActive ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                  </button>

                  <div className="w-px h-5 bg-slate-800 mx-1" />

                  <button
                    onClick={leaveCall}
                    className="p-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-full transition-all shadow-md"
                    title="End Call"
                  >
                    <PhoneOff className="size-4" />
                  </button>
                </div>

                {/* Users Count Status */}
                <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 px-3 py-1 rounded-lg flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Users className="size-3 text-emerald-500" />
                  <span>{Object.keys(peers).length + 1} online</span>
                </div>
              </div>
            )}

            {callState === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-white text-center">
                <AlertCircle className="size-12 text-rose-500 mb-4" />
                <h3 className="text-lg font-bold mb-1">Camera or Microphone Access Required</h3>
                <p className="text-xs text-slate-400 max-w-xs mb-6">
                  Please enable camera and microphone permissions in your browser address bar and refresh the page to start the call.
                </p>
                <button
                  onClick={startPreview}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-lg font-semibold text-xs"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
