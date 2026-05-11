import { useEffect, useRef, useState } from "react";
import { Volume2, Pause, AlertCircle, Loader } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import type { Database } from "../../../types/database";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

interface QueueDisplay {
  id: string;
  queue_number: string;
  status: "waiting" | "called" | "in-service" | "completed";
  completed_at: string | null;
  scheduled_at: string;
}

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

  // Check if a queue's scheduled time has passed
  const hasScheduledTimePassed = (scheduledAt: string): boolean => {
    return new Date(scheduledAt) <= new Date();
  };

  // Get next queue based on scheduled time
  const getNextQueueByScheduledTime = (
    items: QueueDisplay[],
  ): QueueDisplay | null => {
    // Find the first uncompleted item whose scheduled time has passed
    const nextByTime = items.find(
      (item) =>
        item.completed_at === null && hasScheduledTimePassed(item.scheduled_at),
    );

    if (nextByTime) return nextByTime;

    // Fallback to next uncompleted in order
    return items.find((item) => item.completed_at === null) ?? null;
  };
  const formatQueueForSpeech = (queueNumber: string): string => {
    const parts = queueNumber.split("-");

    if (parts.length === 3) {
      const prefix = parts[0].split("").join(" "); // "ODC" -> "O D C"
      const cleanNumber = parseInt(parts[2], 10).toString();

      return `${prefix} Queue ${cleanNumber}`;
    }

    return queueNumber;
  };

  // Fetch queue data from database
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

        // Set the next uncompleted queue as current
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

  // Real-time scheduler based on scheduled_at times
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
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [queueNumbers, currentQueue, autoAnnounce]);

  // Watch for completed appointments and announce next queue
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: "queue_number=neq.null",
        },
        (payload) => {
          const updated = payload.new as Appointment;

          // If an appointment was just completed, announce the next uncompleted queue
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

  // Speak the queue number
  const speakQueueNumber = (queueNumber: string) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const readableText = formatQueueForSpeech(queueNumber);
    const utterance = new SpeechSynthesisUtterance(readableText);

    // Configure speech synthesis
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
      // Update completed_at in database
      await supabase
        .from("appointments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        } as never)
        .eq("id", currentQueue.id);

      // Find next uncompleted queue in line based on scheduled time
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
          // Delay to let the current speech finish
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

  // Initial fetch and cleanup
  useEffect(() => {
    fetchQueueData();

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      waiting: "bg-blue-100 text-blue-800",
      called: "bg-yellow-100 text-yellow-800",
      "in-service": "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
    };
    return colorMap[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Queue Management System
          </h1>
          <p className="text-slate-400">
            Real-time queue announcements and tracking
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-900 bg-opacity-30 border border-red-500 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mb-6 bg-slate-700 rounded-lg p-8 flex items-center justify-center gap-3">
            <Loader className="w-6 h-6 text-blue-400 animate-spin" />
            <p className="text-white">Loading queue data...</p>
          </div>
        )}

        {/* Main Display */}
        {!isLoading && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* Large Queue Number Display */}
              <div className="lg:col-span-2">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 shadow-2xl text-center">
                  <p className="text-white text-lg mb-4 font-semibold">
                    Now Calling
                  </p>
                  {currentQueue ? (
                    <div>
                      <div className="text-7xl font-bold text-white mb-4 font-mono tracking-wider">
                        {currentQueue.queue_number}
                      </div>
                      <div className="flex justify-center gap-4 flex-wrap">
                        <Button
                          onClick={handleToggleSpeech}
                          className="bg-white hover:bg-gray-100 text-blue-600 font-bold px-6 py-2 text-lg"
                        >
                          {isSpeaking ? (
                            <>
                              <Pause className="mr-2 w-5 h-5" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Volume2 className="mr-2 w-5 h-5" />
                              Announce
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleCompleteService}
                          className="border border-white text-white hover:bg-white hover:text-blue-600 px-6 py-2 text-lg"
                        >
                          Complete Service
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white text-xl">No queue available</p>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-4">
                <div className="bg-slate-700 rounded-xl p-6">
                  <h3 className="text-white font-bold mb-4">Controls</h3>
                  <div className="space-y-3">
                    <Button
                      onClick={handleCallNext}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2"
                    >
                      Call Next
                    </Button>
                    <div className="flex items-center justify-between bg-slate-600 p-3 rounded-lg">
                      <label className="text-white font-medium text-sm">
                        Auto Announce
                      </label>
                      <input
                        type="checkbox"
                        checked={autoAnnounce}
                        onChange={(e) => setAutoAnnounce(e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Queue List */}
            <div className="bg-slate-700 rounded-xl shadow-2xl overflow-hidden">
              <div className="bg-slate-800 px-6 py-4 border-b border-slate-600">
                <h2 className="text-white font-bold text-lg">Queue Status</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-600 bg-slate-750">
                      <th className="px-6 py-4 text-left text-white font-semibold">
                        Queue Number
                      </th>
                      <th className="px-6 py-4 text-left text-white font-semibold">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-white font-semibold">
                        Completed At
                      </th>
                      <th className="px-6 py-4 text-left text-white font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueNumbers.map((queue) => (
                      <tr
                        key={queue.id}
                        className={`border-b border-slate-600 ${
                          currentQueue?.id === queue.id
                            ? "bg-blue-900 bg-opacity-50"
                            : "hover:bg-slate-600"
                        } transition-colors`}
                      >
                        <td className="px-6 py-4 text-white font-mono font-bold">
                          {queue.queue_number}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(queue.status)}`}
                          >
                            {queue.status.replace("-", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {queue.completed_at
                            ? new Date(queue.completed_at).toLocaleTimeString()
                            : "-"}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            className="text-white border border-slate-500 hover:bg-slate-600 px-4 py-1 text-sm"
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status Info */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Waiting",
                  value: queueNumbers.filter((q) => q.status === "waiting")
                    .length,
                  bgColor: "bg-blue-900",
                  borderColor: "border-blue-500",
                  textColor: "text-blue-400",
                },
                {
                  label: "Called",
                  value: queueNumbers.filter((q) => q.status === "called")
                    .length,
                  bgColor: "bg-yellow-900",
                  borderColor: "border-yellow-500",
                  textColor: "text-yellow-400",
                },
                {
                  label: "In Service",
                  value: queueNumbers.filter((q) => q.status === "in-service")
                    .length,
                  bgColor: "bg-green-900",
                  borderColor: "border-green-500",
                  textColor: "text-green-400",
                },
                {
                  label: "Completed",
                  value: queueNumbers.filter((q) => q.status === "completed")
                    .length,
                  bgColor: "bg-gray-900",
                  borderColor: "border-gray-500",
                  textColor: "text-gray-400",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`${stat.bgColor} bg-opacity-30 border ${stat.borderColor} rounded-lg p-4 text-center`}
                >
                  <p className="text-slate-300 text-sm font-medium">
                    {stat.label}
                  </p>
                  <p className={`text-3xl font-bold ${stat.textColor}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
