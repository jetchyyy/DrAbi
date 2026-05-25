import { Copy, Link2, Plus, Users, Video, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InternalPage } from '../../components/ui/internal-page';
import { INTERNAL_SURFACE } from '../../lib/internal-ui';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';

const MEETINGS_KEY = 'drabi_doctor_meetings';

interface StoredMeeting {
  id: string;
  title: string;
  createdAt: string;
  hostedBy: string;
}

function loadMeetings(): StoredMeeting[] {
  try {
    return JSON.parse(localStorage.getItem(MEETINGS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveMeetings(meetings: StoredMeeting[]) {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings.slice(0, 20)));
}

function generateMeetingId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getMeetingUrl(meetingId: string): string {
  return `${window.location.origin}/app/meetings/${meetingId}`;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DoctorMeetingsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<StoredMeeting[]>(loadMeetings);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = () => {
    const title = newTitle.trim() || 'Doctor Meeting';
    const meeting: StoredMeeting = {
      id: generateMeetingId(),
      title,
      createdAt: new Date().toISOString(),
      hostedBy: profile?.fullName ?? 'Doctor',
    };
    const updated = [meeting, ...meetings];
    saveMeetings(updated);
    setMeetings(updated);
    setNewTitle('');
    setIsCreating(false);
    void navigate(`/app/meetings/${meeting.id}`);
  };

  const handleCopyLink = (meetingId: string) => {
    void navigator.clipboard.writeText(getMeetingUrl(meetingId));
    toast.success('Meeting link copied to clipboard');
  };

  const handleDelete = (meetingId: string) => {
    const updated = meetings.filter((m) => m.id !== meetingId);
    saveMeetings(updated);
    setMeetings(updated);
  };

  return (
    <InternalPage>
      <div className="space-y-6">
        {/* Header */}
        <div className={cn(INTERNAL_SURFACE, 'flex flex-wrap items-center justify-between gap-4 px-6 py-5')}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-primary) 14%, white)' }}
            >
              <Users className="size-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Teleconference
              </p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Doctor Meetings</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Create or join multi-party video rooms for clinical discussions and team meetings.
              </p>
            </div>
          </div>
          <Button variant="primary" onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 size-4" />
            New Meeting
          </Button>
        </div>

        {/* Create Meeting Inline Panel */}
        {isCreating ? (
          <div className={cn(INTERNAL_SURFACE, 'px-6 py-5')}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">New Meeting</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">Set a title for this meeting room</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Input
                autoFocus
                className="max-w-sm"
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
                placeholder="e.g. Case Review — Dr. Santos"
                value={newTitle}
              />
              <Button variant="primary" onClick={handleCreate}>
                <Video className="mr-2 size-4" />
                Start Meeting
              </Button>
              <Button variant="tertiary" onClick={() => { setIsCreating(false); setNewTitle(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {/* Meetings List */}
        {meetings.length === 0 ? (
          <div className={cn(INTERNAL_SURFACE, 'flex flex-col items-center py-16 text-center')}>
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, white)' }}
            >
              <Video className="size-7" style={{ color: 'var(--color-primary)' }} />
            </div>
            <p className="text-sm font-bold text-slate-900">No meetings yet</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Create a meeting room and share the link with your team. Rooms support unlimited participants.
            </p>
            <Button className="mt-5" variant="primary" onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 size-4" />
              Create your first meeting
            </Button>
          </div>
        ) : (
          <div className={cn(INTERNAL_SURFACE, 'divide-y divide-slate-100')}>
            <div className="border-b border-slate-100 px-6 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                Recent Meetings ({meetings.length})
              </p>
            </div>
            {meetings.map((meeting) => (
              <div
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50/60"
                key={meeting.id}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Video className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{meeting.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {meeting.hostedBy} · {formatRelativeTime(meeting.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                    onClick={() => handleCopyLink(meeting.id)}
                    title="Copy meeting link"
                    type="button"
                  >
                    <Copy className="size-3" />
                    Copy link
                  </button>
                  <Button variant="primary" onClick={() => void navigate(`/app/meetings/${meeting.id}`)}>
                    <Video className="mr-1.5 size-3.5" />
                    Join
                  </Button>
                  <button
                    aria-label="Remove meeting"
                    className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => handleDelete(meeting.id)}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Join by Link */}
        <div className={cn(INTERNAL_SURFACE, 'px-6 py-5')}>
          <div className="flex items-center gap-3">
            <Link2 className="size-4 shrink-0 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">Have a meeting link?</p>
          </div>
          <p className="ml-7 mt-0.5 text-xs text-slate-500">
            Ask a colleague to copy their meeting link and paste it in your browser to join directly.
          </p>
        </div>
      </div>
    </InternalPage>
  );
}
