import {
  AlertCircle,
  Check,
  Link2,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { useAuth } from '../auth/auth-context';
import { supabase } from '../../lib/supabase';

type ScriptState = 'loading' | 'ready' | 'error';
type CallState = 'idle' | 'connected' | 'error';
type JitsiApiHandle = { dispose: () => void };

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
  ],
};

function loadJitsiScript(onReady: () => void, onError: () => void) {
  if (window.JitsiMeetExternalAPI) { onReady(); return () => undefined; }
  const existing = document.querySelector<HTMLScriptElement>('script[data-jitsi-external-api="true"]');
  if (existing) {
    existing.addEventListener('load', onReady);
    existing.addEventListener('error', onError);
    return () => { existing.removeEventListener('load', onReady); existing.removeEventListener('error', onError); };
  }
  const script = document.createElement('script');
  const domain = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';
  script.src = `https://${domain}/external_api.js`;
  script.async = true;
  script.dataset.jitsiExternalApi = 'true';
  script.addEventListener('load', onReady);
  script.addEventListener('error', onError);
  document.body.appendChild(script);
  return () => { script.removeEventListener('load', onReady); script.removeEventListener('error', onError); };
}

function VideoStream({ stream, muted = false, className = '' }: { stream: MediaStream; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} style={{ transform: muted ? 'scaleX(-1)' : 'none' }} />;
}

export function DoctorMeetingRoomPage() {
  const { meetingId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();

  const meetingTitle = searchParams.get('title') ?? 'Doctor Meeting';
  const mode = import.meta.env.VITE_TELECONSULT_MODE || 'custom_webrtc';
  const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';
  const jitsiRoomName = `drabi-meeting-${meetingId}`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<JitsiApiHandle | null>(null);
  const [scriptState, setScriptState] = useState<ScriptState>('loading');

  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inviteRef = useRef<HTMLDivElement | null>(null);

  const meetingUrl = `${window.location.origin}/app/meetings/${meetingId}`;

  useEffect(() => {
    if (!inviteOpen) return;
    const handler = (e: MouseEvent) => {
      if (inviteRef.current && !inviteRef.current.contains(e.target as Node)) {
        setInviteOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inviteOpen]);

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(meetingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const [localVideoActive, setLocalVideoActive] = useState(true);
  const [localAudioActive, setLocalAudioActive] = useState(true);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Jitsi ──
  useEffect(() => {
    if (mode !== 'jitsi') return;
    setScriptState('loading');
    return loadJitsiScript(() => setScriptState('ready'), () => setScriptState('error'));
  }, [mode]);

  useEffect(() => {
    if (mode !== 'jitsi' || !profile || scriptState !== 'ready' || !containerRef.current || !window.JitsiMeetExternalAPI) return;
    apiRef.current?.dispose();
    apiRef.current = new window.JitsiMeetExternalAPI(jitsiDomain, {
      roomName: jitsiRoomName,
      parentNode: containerRef.current,
      width: '100%',
      height: '100%',
      userInfo: { displayName: profile.fullName, email: profile.email },
      configOverwrite: { prejoinPageEnabled: false, startWithAudioMuted: false, startWithVideoMuted: false, disableDeepLinking: true },
      interfaceConfigOverwrite: { MOBILE_APP_PROMO: false, SHOW_JITSI_WATERMARK: false },
    });
    return () => { apiRef.current?.dispose(); apiRef.current = null; };
  }, [profile, scriptState, mode, jitsiDomain, jitsiRoomName]);

  // ── WebRTC preview ──
  useEffect(() => {
    if (mode !== 'custom_webrtc') return;
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        setCallState('error');
      }
    };
    void init();
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      channelRef.current?.unsubscribe();
    };
  }, [mode]);

  const handlePeerLeave = (peerId: string) => {
    peerConnectionsRef.current[peerId]?.close();
    delete peerConnectionsRef.current[peerId];
    setPeers((prev) => { const next = { ...prev }; delete next[peerId]; return next; });
  };

  const joinCall = () => {
    if (!profile || !localStreamRef.current || !supabase) return;
    setCallState('connected');

    const channel = supabase.channel(`meeting-room-${meetingId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'join' }, async ({ payload }) => {
        const { peerId, name, role } = payload as { peerId: string; name: string; role: string };
        peerConnectionsRef.current[peerId]?.close();
        const pc = new RTCPeerConnection(iceServers);
        peerConnectionsRef.current[peerId] = pc;
        localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
        pc.onicecandidate = (e) => { if (e.candidate) channel.send({ type: 'broadcast', event: 'ice-candidate', payload: { senderId: profile.id, targetId: peerId, candidate: e.candidate } }); };
        pc.ontrack = (e) => setPeers((prev) => ({ ...prev, [peerId]: { ...prev[peerId], stream: e.streams[0] } }));
        pc.onconnectionstatechange = () => { if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) handlePeerLeave(peerId); };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({ type: 'broadcast', event: 'offer', payload: { senderId: profile.id, targetId: peerId, name: profile.fullName, role: profile.role, sdp: offer } });
        setPeers((prev) => ({ ...prev, [peerId]: { id: peerId, name, role, peerConnection: pc } }));
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        const { senderId, targetId, name, role, sdp } = payload as { senderId: string; targetId: string; name: string; role: string; sdp: RTCSessionDescriptionInit };
        if (targetId !== profile.id) return;
        peerConnectionsRef.current[senderId]?.close();
        const pc = new RTCPeerConnection(iceServers);
        peerConnectionsRef.current[senderId] = pc;
        localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
        pc.onicecandidate = (e) => { if (e.candidate) channel.send({ type: 'broadcast', event: 'ice-candidate', payload: { senderId: profile.id, targetId: senderId, candidate: e.candidate } }); };
        pc.ontrack = (e) => setPeers((prev) => ({ ...prev, [senderId]: { ...prev[senderId], stream: e.streams[0] } }));
        pc.onconnectionstatechange = () => { if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) handlePeerLeave(senderId); };
        setPeers((prev) => ({ ...prev, [senderId]: { id: senderId, name, role, peerConnection: pc } }));
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({ type: 'broadcast', event: 'answer', payload: { senderId: profile.id, targetId: senderId, name: profile.fullName, role: profile.role, sdp: answer } });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        const { senderId, targetId, sdp } = payload as { senderId: string; targetId: string; sdp: RTCSessionDescriptionInit };
        if (targetId !== profile.id) return;
        const pc = peerConnectionsRef.current[senderId];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        const { senderId, targetId, candidate } = payload as { senderId: string; targetId: string; candidate: RTCIceCandidateInit };
        if (targetId !== profile.id) return;
        const pc = peerConnectionsRef.current[senderId];
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        const { peerId } = payload as { peerId: string };
        handlePeerLeave(peerId);
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'join', payload: { peerId: profile.id, name: profile.fullName, role: profile.role } });
      }
    });
  };

  const leaveCall = () => {
    channelRef.current?.send({ type: 'broadcast', event: 'leave', payload: { peerId: profile?.id } });
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    setPeers({});
    setCallState('idle');
  };

  const toggleVideo = () => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    setLocalVideoActive(tracks[0]?.enabled ?? false);
  };

  const toggleAudio = () => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    setLocalAudioActive(tracks[0]?.enabled ?? false);
  };

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-400">
          <LoaderCircle className="size-5 animate-spin" />
          <span className="text-sm">Loading meeting room…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
            <Users className="size-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">{meetingTitle}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {mode === 'jitsi' ? 'Jitsi Meeting' : 'In-house Secure Call'} · {Object.keys(peers).length + 1} participant{Object.keys(peers).length !== 0 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Invite popover */}
          <div className="relative" ref={inviteRef}>
            <button
              onClick={() => setInviteOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Link2 className="size-3.5" />
              Invite
            </button>

            {inviteOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-bold text-slate-900">Share Meeting Link</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    Anyone with this link can join the meeting
                  </p>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-600">
                      {meetingUrl}
                    </span>
                    <button
                      onClick={copyMeetingLink}
                      className="shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold transition"
                      style={
                        copied
                          ? { background: 'color-mix(in srgb, var(--color-primary) 14%, white)', color: 'var(--color-primary)' }
                          : { background: '#e2e8f0', color: '#475569' }
                      }
                    >
                      {copied ? (
                        <span className="flex items-center gap-1">
                          <Check className="size-3" /> Copied
                        </span>
                      ) : (
                        'Copy'
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400">
                    Send this link via SMS or email to invite participants
                  </p>
                </div>
              </div>
            )}
          </div>

          <Link
            className="rounded-md border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            to="/app/meetings"
          >
            ← Back to Meetings
          </Link>
        </div>
      </header>

      {/* Jitsi mode */}
      {mode === 'jitsi' && (
        <div className="flex-1">
          {scriptState === 'error' ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="mb-4 size-12 text-rose-500" />
              <p className="font-bold text-slate-900">Unable to load video component</p>
              <p className="mt-1 text-sm text-slate-400">Please refresh the page and try again.</p>
            </div>
          ) : (
            <div className="h-[calc(100vh-57px)] bg-slate-100">
              <div className="h-full w-full" ref={containerRef} />
            </div>
          )}
        </div>
      )}

      {/* WebRTC mode */}
      {mode === 'custom_webrtc' && (
        <div className="relative flex flex-1 flex-col" style={{ height: 'calc(100vh - 57px)' }}>
          {/* Idle / preview */}
          {callState === 'idle' && (
            <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-6 text-center">
              <div className="relative mb-6 aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-lg">
                {localStream && localVideoActive ? (
                  <VideoStream className="h-full w-full object-cover" muted stream={localStream} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <VideoOff className="mb-2 size-10" />
                    <p className="text-xs">Camera is off</p>
                  </div>
                )}
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
                  <button onClick={toggleAudio} className={`rounded-full p-2 shadow-md transition-colors ${localAudioActive ? 'bg-white/80 text-slate-700 hover:bg-white' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                    {localAudioActive ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                  </button>
                  <button onClick={toggleVideo} className={`rounded-full p-2 shadow-md transition-colors ${localVideoActive ? 'bg-white/80 text-slate-700 hover:bg-white' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                    {localVideoActive ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Ready to join?</h3>
              <p className="mt-1 max-w-xs text-xs text-slate-500">Check your camera and mic before joining the group call.</p>
              <button
                className="mt-6 flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all active:scale-95 hover:brightness-95"
                onClick={joinCall}
                style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 8px 20px -6px color-mix(in srgb, var(--color-primary) 50%, transparent)' }}
              >
                <Video className="size-4" />
                Join Meeting
              </button>
            </div>
          )}

          {/* Connected */}
          {callState === 'connected' && (
            <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-slate-50">
              <div
                className={`flex-1 grid gap-4 overflow-y-auto p-4 items-center justify-center ${
                  Object.keys(peers).length === 0 ? 'grid-cols-1' :
                  Object.keys(peers).length === 1 ? 'grid-cols-1 md:grid-cols-2' :
                  'grid-cols-2 md:grid-cols-3'
                }`}
              >
                {/* Local */}
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm">
                  {localStream && localVideoActive ? (
                    <VideoStream className="h-full w-full object-cover" muted stream={localStream} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                      <VideoOff className="mb-2 size-10" />
                      <p className="text-xs">Your camera is off</p>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700 backdrop-blur-md">
                    <span>{profile.fullName} (You)</span>
                    {!localAudioActive && <MicOff className="size-3 text-rose-500" />}
                  </div>
                </div>
                {/* Remote feeds */}
                {Object.values(peers).map((peer) => (
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm" key={peer.id}>
                    {peer.stream ? (
                      <VideoStream className="h-full w-full object-cover" stream={peer.stream} />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                        <LoaderCircle className="mb-2 size-8 animate-spin" />
                        <p className="text-xs font-semibold">Connecting to {peer.name}…</p>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 rounded bg-white/80 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-700 backdrop-blur-md">
                      {peer.name} ({peer.role})
                    </div>
                  </div>
                ))}
              </div>

              {/* Participant count badge */}
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-md">
                <Users className="size-3" style={{ color: 'var(--color-primary)' }} />
                <span>{Object.keys(peers).length + 1} online</span>
              </div>

              {/* Controls */}
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-6 py-2.5 shadow-lg backdrop-blur-md">
                <button onClick={toggleAudio} className={`rounded-full p-2.5 transition-colors ${localAudioActive ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                  {localAudioActive ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                </button>
                <button onClick={toggleVideo} className={`rounded-full p-2.5 transition-colors ${localVideoActive ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                  {localVideoActive ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                </button>
                <div className="mx-1 h-5 w-px bg-slate-200" />
                <button onClick={leaveCall} className="rounded-full bg-rose-600 p-2.5 text-white shadow-md transition-all hover:bg-rose-700 active:scale-95">
                  <PhoneOff className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {callState === 'error' && (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="mb-4 size-12 text-rose-500" />
              <h3 className="text-lg font-bold">Camera or Microphone Required</h3>
              <p className="mt-1 max-w-xs text-xs text-slate-400">Enable permissions in your browser and refresh to join the meeting.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
