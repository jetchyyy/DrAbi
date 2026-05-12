import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { useClinicSettingsData } from "../../../hooks/use-clinic-data";
import type { Database } from "../../../types/database";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

interface QueueItem {
  id: string;
  queue_number: string;
  display_number: string;
  completed_at: string | null;
  scheduled_at: string;
}

const defaultClinicSettings = { clinicName: "CPR Med Clinic" };

const VISUAL_RESET_HOUR = 22;

const getVisualResetKey = (scheduledAt: string): string | null => {
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime()) || date.getHours() < VISUAL_RESET_HOUR) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildResetDisplayNumber = (original: string, nextNumber: number) => {
  const match = original.match(/^(.*-)(\d+)$/);
  if (!match) {
    return String(nextNumber);
  }

  const prefix = match[1];
  const width = match[2].length;
  return `${prefix}${String(nextNumber).padStart(width, "0")}`;
};

const applyVisualQueueReset = (items: QueueItem[]): QueueItem[] => {
  const counters = new Map<string, number>();

  return items.map((item) => {
    const resetKey = getVisualResetKey(item.scheduled_at);
    if (!resetKey) {
      return { ...item, display_number: item.queue_number };
    }

    const nextNumber = (counters.get(resetKey) ?? 0) + 1;
    counters.set(resetKey, nextNumber);
    return {
      ...item,
      display_number: buildResetDisplayNumber(item.queue_number, nextNumber),
    };
  });
};

function SoundWave({ active }: { active: boolean }) {
  const heights = [4, 8, 13, 7, 17, 9, 13, 6, 15, 8, 11, 5];
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 20 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[2.5px] rounded-full"
          style={
            active
              ? {
                  height: h,
                  background: "var(--color-primary)",
                  animation: `waveBar 0.7s ease-in-out ${i * 0.07}s infinite alternate`,
                  transformOrigin: "bottom",
                }
              : { height: 2, background: "rgba(0,0,0,0.12)" }
          }
        />
      ))}
    </div>
  );
}

export function AppointmentsQueueTv() {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [currentQueue, setCurrentQueue] = useState<QueueItem | null>(null);
  const [previousQueue, setPreviousQueue] = useState<QueueItem | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const lastAnnouncedRef = useRef<string | null>(null);
  const pendingAnnounceRef = useRef<string | null>(null);
  const prevCurrentRef = useRef<QueueItem | null>(null);
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();

  const formatQueueForSpeech = (queueNumber: string): string => {
    const parts = queueNumber.split("-");
    if (parts.length === 3) {
      const prefix = parts[0].split("").join(" ");
      const cleanNumber = parseInt(parts[2], 10).toString();
      return `${prefix} Queue ${cleanNumber}. Please proceed inside.`;
    }
    return `${queueNumber}. Please proceed inside.`;
  };

  const speakQueueNumber = useCallback((queueNumber: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      formatQueueForSpeech(queueNumber),
    );
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const fetchQueueData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data } = await supabase
      .from("appointments")
      .select("id, queue_number, completed_at, scheduled_at")
      .not("queue_number", "is", null)
      .order("scheduled_at", { ascending: true });

    if (data && Array.isArray(data)) {
      const rawItems: QueueItem[] = (data as AppointmentRow[]).map((apt) => ({
        id: apt.id,
        queue_number: apt.queue_number || "",
        display_number: apt.queue_number || "",
        completed_at: apt.completed_at,
        scheduled_at: apt.scheduled_at || new Date().toISOString(),
      }));
      const items = applyVisualQueueReset(rawItems);
      setQueueItems(items);

      const next = items.find((i) => i.completed_at === null) ?? null;
      setCurrentQueue((prev) => {
        // Track the previous queue whenever it changes
        if (prev && next && prev.id !== next.id) {
          setPreviousQueue(prev);
        }
        prevCurrentRef.current = prev;
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    fetchQueueData();

    const channel = supabase
      .channel("tv-queue-display")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => fetchQueueData(),
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    const poll = setInterval(() => fetchQueueData(), 10_000);

    return () => {
      clearInterval(poll);
      channel.unsubscribe();
      window.speechSynthesis.cancel();
    };
  }, [fetchQueueData]);

  useEffect(() => {
    if (currentQueue && currentQueue.id !== lastAnnouncedRef.current) {
      if (audioUnlocked) {
        speakQueueNumber(currentQueue.display_number);
        lastAnnouncedRef.current = currentQueue.id;
      } else {
        pendingAnnounceRef.current = currentQueue.id;
      }
    }
  }, [currentQueue, speakQueueNumber, audioUnlocked]);

  const handleUnlockAudio = () => {
    setAudioUnlocked(true);
    const silent = new SpeechSynthesisUtterance(" ");
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
    const pendingId = pendingAnnounceRef.current ?? currentQueue?.id;
    const pendingQueue = pendingId
      ? (queueItems.find((queue) => queue.id === pendingId) ?? currentQueue)
      : null;
    if (pendingQueue) {
      setTimeout(() => {
        speakQueueNumber(pendingQueue.display_number);
        lastAnnouncedRef.current = pendingQueue.id;
        pendingAnnounceRef.current = null;
      }, 300);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const upcomingQueues = queueItems
    .filter((q) => q.completed_at === null && q.id !== currentQueue?.id)
    .slice(0, 5);

  const completedCount = queueItems.filter(
    (q) => q.completed_at !== null,
  ).length;
  const totalCount = queueItems.length;
  const remainingCount = queueItems.filter(
    (q) => q.completed_at === null,
  ).length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <>
      <style>{`
        @keyframes soundBar {
          from { transform: scaleY(0.35); opacity: 0.6; }
          to   { transform: scaleY(1.7);  opacity: 1;   }
        }
        @keyframes waveBar {
          from { transform: scaleY(0.35); opacity: 0.5; }
          to   { transform: scaleY(1.7);  opacity: 1;   }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes subtlePulse {
          0%, 100% { opacity: 0.04; }
          50%       { opacity: 0.09; }
        }
        .queue-number-enter {
          animation: fadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
      `}</style>

      {/* ── Audio unlock overlay ─────────────────────────────── */}
      {!audioUnlocked && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-8"
          style={{ background: "#f7f8fa" }}
          onClick={handleUnlockAudio}
        >
          <img
            src="/logo.png"
            alt={clinic.clinicName}
            className="h-20 w-auto object-contain opacity-80"
          />
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full"
            style={{
              background: "rgba(125,212,83,0.1)",
              border: "1px solid rgba(125,212,83,0.3)",
            }}
          >
            <Volume2 className="h-12 w-12 text-[var(--color-primary)]" />
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold tracking-tight text-slate-900">
              Tap anywhere to start
            </p>
            <p className="mt-2 text-base text-slate-400">
              Enables audio announcements for the queue display
            </p>
          </div>
          <div
            className="flex items-center gap-2 rounded-full px-5 py-2.5"
            style={{
              background: "rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Live — {clinic.clinicName}
            </span>
          </div>
        </div>
      )}

      {/* ── TV Shell ─────────────────────────────────────────── */}
      <div
        className="flex h-screen flex-col overflow-hidden font-sans text-slate-900"
        style={{ background: "#f7f8fa" }}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <header
          className="flex shrink-0 items-center justify-between px-8 py-4"
          style={{
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            background: "rgba(0,0,0,0.015)",
          }}
        >
          {/* Brand */}
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt={clinic.clinicName}
              className="h-11 w-auto object-contain opacity-90"
            />
            <div
              className="h-8 w-px"
              style={{ background: "rgba(0,0,0,0.12)" }}
            />
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.3em]"
                style={{ color: "var(--color-primary)" }}
              >
                Patient Queue
              </p>
              <p className="text-sm font-bold text-slate-600">
                {clinic.clinicName}
              </p>
            </div>
          </div>

          {/* Right: live badge + clock */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Live
                  </span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2 rounded-full bg-rose-500" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-rose-600">
                    Offline
                  </span>
                </>
              )}
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-bold tabular-nums text-slate-900">
                {currentTime.toLocaleTimeString("en-PH", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
              <p className="text-[11px] text-slate-400">
                {currentTime.toLocaleDateString("en-PH", {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </header>

        {/* ── Main ─────────────────────────────────────────────── */}
        <main className="grid min-h-0 flex-1 grid-cols-[1fr_310px]">
          {/* Left: Now Serving */}
          <div
            className="relative flex flex-col items-center justify-center overflow-hidden px-12 py-10"
            style={{ borderRight: "1px solid rgba(0,0,0,0.07)" }}
          >
            {/* Ambient glow — pulses when speaking */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 55% 45% at 50% 60%, var(--color-primary), transparent)",
                opacity: isSpeaking ? 0.11 : 0.05,
                transition: "opacity 0.8s ease",
                animation: isSpeaking
                  ? "subtlePulse 2s ease-in-out infinite"
                  : "none",
              }}
            />
            {/* Centered watermark logo */}
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute select-none"
              style={{
                width: "clamp(180px, 28vw, 360px)",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                opacity: 0.05,
                objectFit: "contain",
              }}
            />
            {/* NOW SERVING label */}
            <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.5em] text-slate-400">
              Now Serving
            </p>

            {currentQueue ? (
              <>
                {/* Rings during announcement */}
                <div className="relative flex items-center justify-center">
                  {isSpeaking && (
                    <>
                      <span
                        className="absolute rounded-full"
                        style={{
                          inset: "-20%",
                          border: "1px solid rgba(125,212,83,0.30)",
                          animation:
                            "soundBar 1.5s ease-in-out infinite alternate",
                        }}
                      />
                      <span
                        className="absolute rounded-full"
                        style={{
                          inset: "-36%",
                          border: "1px solid rgba(125,212,83,0.18)",
                          animation:
                            "soundBar 2s ease-in-out 0.4s infinite alternate",
                        }}
                      />
                    </>
                  )}
                  <span
                    key={currentQueue.id}
                    className="queue-number-enter relative font-mono font-bold leading-none tracking-tight"
                    style={{
                      fontSize: "clamp(4.5rem, 13vw, 9.5rem)",
                      color: "#0f172a",
                      textShadow: isSpeaking
                        ? "0 0 60px rgba(125,212,83,0.4), 0 0 120px rgba(125,212,83,0.18)"
                        : "0 2px 12px rgba(0,0,0,0.06)",
                      transition: "text-shadow 0.6s ease",
                    }}
                  >
                    {currentQueue.display_number}
                  </span>
                </div>

                {/* Announcement bar */}
                <div
                  className="mt-10 flex items-center gap-4 rounded-2xl px-8 py-4"
                  style={{
                    background: isSpeaking
                      ? "rgba(125,212,83,0.09)"
                      : "rgba(0,0,0,0.04)",
                    border: isSpeaking
                      ? "1px solid rgba(125,212,83,0.32)"
                      : "1px solid rgba(0,0,0,0.08)",
                    transition: "background 0.5s ease, border-color 0.5s ease",
                  }}
                >
                  <Volume2
                    className="h-5 w-5 shrink-0"
                    style={{
                      color: isSpeaking
                        ? "var(--color-primary)"
                        : "rgba(100,116,139,0.6)",
                      transition: "color 0.4s ease",
                    }}
                  />
                  <SoundWave active={isSpeaking} />
                  <div
                    className="mx-1 h-5 w-px"
                    style={{ background: "rgba(0,0,0,0.1)" }}
                  />
                  <p
                    className="text-base font-semibold tracking-wide"
                    style={{
                      color: isSpeaking
                        ? "var(--color-primary)"
                        : "rgb(100,116,139)",
                      transition: "color 0.4s ease",
                    }}
                  >
                    {isSpeaking
                      ? "Announcing now…"
                      : "Please proceed to the counter"}
                  </p>
                </div>

                {/* Previous queue */}
                {previousQueue && (
                  <div className="mt-5 flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Previous:
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-500">
                      {previousQueue.display_number}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        background: "rgba(0,0,0,0.05)",
                        color: "rgb(100,116,139)",
                      }}
                    >
                      Done
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center">
                <p
                  className="font-mono text-8xl font-bold"
                  style={{ color: "rgba(203,213,225,1)" }}
                >
                  —
                </p>
                <p className="mt-5 text-lg text-slate-400">
                  No active queue at this time
                </p>
              </div>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────── */}
          <div className="flex flex-col">
            {/* Up Next */}
            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                Up Next
              </p>
              {upcomingQueues.length > 0 ? (
                <div className="space-y-2">
                  {upcomingQueues.map((q, i) => (
                    <div
                      key={q.id}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{
                        background:
                          i === 0
                            ? "rgba(125,212,83,0.09)"
                            : "rgba(0,0,0,0.03)",
                        border:
                          i === 0
                            ? "1px solid rgba(125,212,83,0.25)"
                            : "1px solid rgba(0,0,0,0.07)",
                      }}
                    >
                      <span className="w-5 text-center text-xs font-bold tabular-nums text-slate-400">
                        {i + 1}
                      </span>
                      <span
                        className="font-mono text-base font-bold tabular-nums"
                        style={{
                          color: i === 0 ? "rgb(15,23,42)" : "rgb(100,116,139)",
                        }}
                      >
                        {q.display_number}
                      </span>
                      {i === 0 && (
                        <span
                          className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                          style={{
                            background: "rgba(125,212,83,0.15)",
                            color: "var(--color-primary)",
                          }}
                        >
                          Next
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No more in queue</p>
              )}
            </div>

            {/* Divider */}
            <div
              className="mx-5"
              style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}
            />

            {/* Stats */}
            <div className="px-5 py-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                Today's Progress
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: "rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.07)",
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Served
                  </p>
                  <p
                    className="mt-0.5 font-mono text-2xl font-bold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {completedCount}
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: "rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.07)",
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Waiting
                  </p>
                  <p
                    className="mt-0.5 font-mono text-2xl font-bold"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {remainingCount}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="mb-1.5 flex justify-between text-[10px] font-semibold text-slate-400">
                  <span>Progress</span>
                  <span>
                    {completedCount} / {totalCount}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: "rgba(0,0,0,0.08)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progressPct}%`,
                      background: "var(--color-primary)",
                      boxShadow:
                        progressPct > 0
                          ? "0 0 10px rgba(125,212,83,0.5)"
                          : "none",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer brand */}
            <div
              className="flex items-center justify-center gap-2 px-5 py-3"
              style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
            >
              <img
                src="/logo.png"
                alt=""
                aria-hidden="true"
                className="h-5 w-auto object-contain opacity-20"
              />
              <span className="text-[10px] font-semibold text-slate-400">
                {clinic.clinicName}
              </span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
