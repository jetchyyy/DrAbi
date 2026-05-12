import { useEffect, useRef, useState } from "react";
import {
  Volume2,
  Pause,
  AlertCircle,
  Loader2,
  Monitor,
  CheckCircle2,
  ExternalLink,
  SkipForward,
  Users,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import {
  INTERNAL_SURFACE,
  INTERNAL_TABLE,
  INTERNAL_TH,
  INTERNAL_TD,
  INTERNAL_TR,
  INTERNAL_THEAD_ROW,
} from "../../../lib/internal-ui";
import { cn } from "../../../lib/utils";
import type { Database } from "../../../types/database";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

interface QueueDisplay {
  id: string;
  queue_number: string;
  status: "waiting" | "called" | "in-service" | "completed";
  completed_at: string | null;
  scheduled_at: string;
}

const STATUS_CONFIG: Record<
  QueueDisplay["status"],
  { label: string; className: string }
> = {
  waiting: {
    label: "Waiting",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  called: {
    label: "Called",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  "in-service": {
    label: "In Service",
    className:
      "bg-[color-mix(in_srgb,var(--color-primary)_10%,white)] text-slate-800 ring-1 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]",
  },
  completed: {
    label: "Completed",
    className: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  },
};

export function AppointmentsQueueDisplay() {
  const [queueNumbers, setQueueNumbers] = useState<QueueDisplay[]>([]);
  const [currentQueue, setCurrentQueue] = useState<QueueDisplay | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoAnnounce, setAutoAnnounce] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastAnnouncedRef = useRef<string | null>(null);

  const getNextQueueInLine = (items: QueueDisplay[]) =>
    items.find((item) => item.completed_at === null) ?? null;

  const hasScheduledTimePassed = (scheduledAt: string): boolean => {
    return new Date(scheduledAt) <= new Date();
  };

  const getNextQueueByScheduledTime = (
    items: QueueDisplay[],
  ): QueueDisplay | null => {
    const nextByTime = items.find(
      (item) =>
        item.completed_at === null && hasScheduledTimePassed(item.scheduled_at),
    );
    if (nextByTime) return nextByTime;
    return items.find((item) => item.completed_at === null) ?? null;
  };

  const formatQueueForSpeech = (queueNumber: string): string => {
    const parts = queueNumber.split("-");
    if (parts.length === 3) {
      const prefix = parts[0].split("").join(" ");
      const cleanNumber = parseInt(parts[2], 10).toString();
      return `${prefix} Queue ${cleanNumber}. Please proceed inside.`;
    }
    return `${queueNumber}. Please proceed inside.`;
  };

  const fetchQueueData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase not configured");
      }

      const { data, error: fetchError } = await supabase
        .from("appointments")
        .select("id, queue_number, status, completed_at, scheduled_at")
        .not("queue_number", "is", null)
        .order("scheduled_at", { ascending: true });

      if (fetchError) throw fetchError;

      if (data && Array.isArray(data)) {
        const formattedData: QueueDisplay[] = (data as Appointment[]).map(
          (apt) => ({
            id: apt.id,
            queue_number: apt.queue_number || "",
            status: apt.completed_at
              ? "completed"
              : apt.status === "in-service"
                ? "in-service"
                : apt.status === "scheduled"
                  ? "waiting"
                  : ("called" as const),
            completed_at: apt.completed_at,
            scheduled_at: apt.scheduled_at || new Date().toISOString(),
          }),
        );

        setQueueNumbers(formattedData);

        const nextInLine = getNextQueueInLine(formattedData);
        if (
          nextInLine &&
          (!currentQueue || currentQueue.id !== nextInLine.id)
        ) {
          setCurrentQueue(nextInLine);
        }
      }
    } catch (err) {
      console.error("Error fetching queue data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch queue data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!queueNumbers.length) return;

    const interval = setInterval(() => {
      const nextQueue = getNextQueueByScheduledTime(queueNumbers);

      if (nextQueue && currentQueue?.id !== nextQueue.id) {
        setCurrentQueue(nextQueue);
        if (autoAnnounce) {
          speakQueueNumber(nextQueue.queue_number);
          lastAnnouncedRef.current = nextQueue.queue_number;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [queueNumbers, currentQueue, autoAnnounce]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        (payload) => {
          const updated = payload.new as Appointment;

          if (
            updated.completed_at &&
            autoAnnounce &&
            currentQueue?.id === updated.id
          ) {
            const refreshedQueues = queueNumbers.map((queue) =>
              queue.id === updated.id
                ? {
                    ...queue,
                    completed_at: updated.completed_at,
                    status: "completed" as const,
                  }
                : queue,
            );
            const nextQueue = getNextQueueByScheduledTime(refreshedQueues);

            if (
              nextQueue &&
              nextQueue.queue_number !== lastAnnouncedRef.current
            ) {
              setTimeout(() => {
                speakQueueNumber(nextQueue.queue_number);
                lastAnnouncedRef.current = nextQueue.queue_number;
              }, 500);
            }
          }

          fetchQueueData();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [autoAnnounce, currentQueue, queueNumbers]);

  const speakQueueNumber = (queueNumber: string) => {
    window.speechSynthesis.cancel();

    const readableText = formatQueueForSpeech(queueNumber);
    const utterance = new SpeechSynthesisUtterance(readableText);

    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else if (currentQueue) {
      speakQueueNumber(currentQueue.queue_number);
    }
  };

  const handleCallNext = async () => {
    const waitingQueue = getNextQueueByScheduledTime(queueNumbers);
    if (!waitingQueue || !supabase) return;

    try {
      setCurrentQueue(waitingQueue);
      if (autoAnnounce) {
        speakQueueNumber(waitingQueue.queue_number);
        lastAnnouncedRef.current = waitingQueue.queue_number;
      }
    } catch (err) {
      console.error("Error calling next queue:", err);
    }
  };

  const handleCompleteService = async () => {
    if (!currentQueue || !supabase) return;

    try {
      await supabase
        .from("appointments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        } as never)
        .eq("id", currentQueue.id);

      const nextQueue = getNextQueueByScheduledTime(
        queueNumbers.map((queue) =>
          queue.id === currentQueue.id
            ? {
                ...queue,
                completed_at: new Date().toISOString(),
                status: "completed" as const,
              }
            : queue,
        ),
      );
      if (nextQueue) {
        setCurrentQueue(nextQueue);
        if (autoAnnounce) {
          setTimeout(() => {
            speakQueueNumber(nextQueue.queue_number);
            lastAnnouncedRef.current = nextQueue.queue_number;
          }, 500);
        }
      }

      await fetchQueueData();
    } catch (err) {
      console.error("Error completing service:", err);
    }
  };

  useEffect(() => {
    fetchQueueData();
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const completedCount = queueNumbers.filter(
    (q) => q.status === "completed",
  ).length;

  const stats = [
    {
      label: "Waiting",
      value: queueNumbers.filter((q) => q.status === "waiting").length,
      valueClass: "text-blue-600",
      cardClass: "border-blue-100 bg-blue-50/50",
    },
    {
      label: "Called",
      value: queueNumbers.filter((q) => q.status === "called").length,
      valueClass: "text-amber-600",
      cardClass: "border-amber-100 bg-amber-50/50",
    },
    {
      label: "In Service",
      value: queueNumbers.filter((q) => q.status === "in-service").length,
      valueClass: "text-[var(--color-primary)]",
      cardClass:
        "border-[color-mix(in_srgb,var(--color-primary)_25%,white)] bg-[color-mix(in_srgb,var(--color-primary)_5%,white)]",
    },
    {
      label: "Completed",
      value: completedCount,
      valueClass: "text-slate-500",
      cardClass: "border-slate-100 bg-slate-50/50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Display Queue
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage and announce patient queue numbers in real time
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Live badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
              Live
            </span>
          </div>
          {/* Open TV Display */}
          <a
            href="/queue-display"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
          >
            <Monitor className="h-4 w-4 text-slate-500" />
            Open TV Display
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────── */}
      {isLoading ? (
        <div
          className={cn(
            INTERNAL_SURFACE,
            "flex items-center justify-center gap-3 p-20",
          )}
        >
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Loading queue data…</p>
        </div>
      ) : (
        <>
          {/* ── Queue progress bar ──────────────────────────────── */}
          {queueNumbers.length > 0 && (
            <div className={cn(INTERNAL_SURFACE, "px-6 py-4")}>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  Queue Progress
                </span>
                <span className="text-xs font-bold text-slate-700">
                  {completedCount} / {queueNumbers.length} served
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-700"
                  style={{
                    width: `${queueNumbers.length > 0 ? (completedCount / queueNumbers.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Main grid ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Now Calling — spans 2 cols */}
            <div className={cn(INTERNAL_SURFACE, "overflow-hidden lg:col-span-2")}>
              {/* Tinted header strip */}
              <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--color-primary)_18%,white)] bg-[color-mix(in_srgb,var(--color-primary)_7%,white)] px-6 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-primary)_20%,white)]">
                    <Volume2 className="h-4 w-4 text-[var(--color-primary)]" />
                  </span>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Now Calling
                  </h2>
                </div>
                {/* Toggle switch */}
                <label className="flex cursor-pointer select-none items-center gap-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Auto Announce
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoAnnounce}
                    onClick={() => setAutoAnnounce((v) => !v)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                      autoAnnounce
                        ? "bg-[var(--color-primary)]"
                        : "bg-slate-200",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                        autoAnnounce ? "translate-x-4" : "translate-x-1",
                      )}
                    />
                  </button>
                </label>
              </div>

              {/* Body */}
              {currentQueue ? (
                <div className="flex flex-col items-center px-8 py-10 text-center">
                  {/* Animated rings + queue number */}
                  <div className="relative mb-6 flex items-center justify-center">
                    {isSpeaking && (
                      <>
                        <span
                          className="absolute h-52 w-52 animate-ping rounded-full bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
                          style={{ animationDuration: "1.6s" }}
                        />
                        <span
                          className="absolute h-36 w-36 animate-ping rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                          style={{ animationDuration: "1.1s" }}
                        />
                      </>
                    )}
                    <div
                      className={cn(
                        "relative rounded-2xl px-10 py-5 transition-all duration-300",
                        isSpeaking
                          ? "bg-[color-mix(in_srgb,var(--color-primary)_10%,white)] ring-2 ring-[color-mix(in_srgb,var(--color-primary)_35%,white)]"
                          : "bg-slate-50 ring-1 ring-slate-200",
                      )}
                    >
                      <span className="font-mono text-7xl font-bold leading-none tracking-tight text-slate-900">
                        {currentQueue.queue_number}
                      </span>
                    </div>
                  </div>

                  {/* Speaking status pill */}
                  <div
                    className={cn(
                      "mb-8 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all",
                      isSpeaking
                        ? "bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] text-slate-700 ring-1 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {isSpeaking ? (
                      <>
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                        </span>
                        Announcing now
                      </>
                    ) : (
                      "Ready to announce"
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button onClick={handleToggleSpeech} variant="primary">
                      {isSpeaking ? (
                        <>
                          <Pause className="mr-2 h-4 w-4" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Volume2 className="mr-2 h-4 w-4" />
                          Announce
                        </>
                      )}
                    </Button>
                    <Button onClick={handleCompleteService} variant="secondary">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-[var(--color-primary)]" />
                      Mark as Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <Volume2 className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-500">
                    No active queue
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    All patients have been served
                  </p>
                </div>
              )}
            </div>

            {/* Right column: stats + controls */}
            <div className="flex flex-col gap-4">
              {/* Stats grid */}
              <div className={cn(INTERNAL_SURFACE, "p-5")}>
                <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Today's Summary
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className={cn(
                        "rounded-xl border p-3 text-center",
                        stat.cardClass,
                      )}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                        {stat.label}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-3xl font-bold tabular-nums",
                          stat.valueClass,
                        )}
                      >
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className={cn(INTERNAL_SURFACE, "p-5")}>
                <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Controls
                </h3>
                <Button
                  onClick={handleCallNext}
                  variant="primary"
                  className="w-full justify-center py-3"
                >
                  <SkipForward className="mr-2 h-4 w-4" />
                  Call Next Patient
                </Button>
                <p className="mt-2.5 text-center text-[11px] text-slate-400">
                  Advances to the next scheduled queue entry
                </p>
              </div>
            </div>
          </div>

          {/* ── Queue Table ─────────────────────────────────────── */}
          <div className={INTERNAL_SURFACE}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="font-display text-base font-bold text-slate-900">
                Queue List
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                {queueNumbers.length} total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className={INTERNAL_TABLE}>
                <thead>
                  <tr className={INTERNAL_THEAD_ROW}>
                    <th className={INTERNAL_TH}>#</th>
                    <th className={INTERNAL_TH}>Queue Number</th>
                    <th className={INTERNAL_TH}>Status</th>
                    <th className={INTERNAL_TH}>Scheduled</th>
                    <th className={INTERNAL_TH}>Completed</th>
                    <th className={INTERNAL_TH}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queueNumbers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-sm text-slate-400"
                      >
                        No queue entries found
                      </td>
                    </tr>
                  ) : (
                    queueNumbers.map((queue, index) => (
                      <tr
                        key={queue.id}
                        className={cn(
                          INTERNAL_TR,
                          "relative",
                          currentQueue?.id === queue.id &&
                            "bg-[color-mix(in_srgb,var(--color-primary)_5%,white)]",
                          queue.status === "completed" && "opacity-50",
                        )}
                      >
                        {/* Active row left indicator */}
                        {currentQueue?.id === queue.id && (
                          <td
                            className="absolute inset-y-0 left-0 w-[3px] rounded-l-sm bg-[var(--color-primary)]"
                            aria-hidden="true"
                          />
                        )}
                        <td
                          className={cn(
                            INTERNAL_TD,
                            "tabular-nums text-slate-400",
                          )}
                        >
                          {index + 1}
                        </td>
                        <td
                          className={cn(
                            INTERNAL_TD,
                            "font-mono font-bold text-slate-900",
                          )}
                        >
                          {queue.queue_number}
                        </td>
                        <td className={INTERNAL_TD}>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              STATUS_CONFIG[queue.status].className,
                            )}
                          >
                            {STATUS_CONFIG[queue.status].label}
                          </span>
                        </td>
                        <td
                          className={cn(
                            INTERNAL_TD,
                            "tabular-nums text-xs text-slate-500",
                          )}
                        >
                          {new Date(queue.scheduled_at).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </td>
                        <td
                          className={cn(
                            INTERNAL_TD,
                            "tabular-nums text-xs text-slate-500",
                          )}
                        >
                          {queue.completed_at
                            ? new Date(queue.completed_at).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "—"}
                        </td>
                        <td className={INTERNAL_TD}>
                          <Button
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            disabled={queue.status === "completed"}
                            onClick={() => {
                              setCurrentQueue(queue);
                              if (autoAnnounce) {
                                speakQueueNumber(queue.queue_number);
                              }
                            }}
                          >
                            Select
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
