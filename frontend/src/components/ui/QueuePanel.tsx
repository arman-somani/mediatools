'use client';

import { Clock, Loader2 } from 'lucide-react';
import type { ServerQueueState } from '@/lib/useServerQueue';

interface QueuePanelProps {
  queue: ServerQueueState;
  /** Shown while the visitor already has a job running; copy can differ. */
  waitingForOwnJob?: boolean;
}

/**
 * Live "server is busy" readout for the tool pages.
 *
 * Conversions run strictly one at a time on the server, so when someone else
 * is mid-download, a new user's job will queue behind it. Saying that up
 * front — with the running job's title and live progress — turns "why is my
 * download stuck at 0%" into "the server is working, I am next".
 *
 * Renders nothing while the worker is free, so on a quiet day the UI is
 * unchanged.
 */
export default function QueuePanel({ queue, waitingForOwnJob = false }: QueuePanelProps) {
  const { busy, waiting, current } = queue;
  if (!busy || !current) return null;

  const progress = Math.max(0, Math.min(100, Math.round(current.progress)));
  const kindLabel = current.type === 'audio' ? 'a song' : current.type === 'video' ? 'a video' : 'a file';

  return (
    <div className="alert alert-info anim-fade-up !items-start" role="status" aria-live="polite">
      <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin text-accent" />
      <div className="min-w-0 flex-1">
        <p className="mono-label !text-[10px] mb-1.5">
          <span className="status-dot text-accent inline-block mr-1.5" />
          SERVER QUEUE · {waiting} WAITING
        </p>
        <p className="font-semibold text-[13.5px] truncate">
          Downloading {kindLabel} for someone else — {progress}%
        </p>
        <p className="mt-0.5 text-[13px] text-fg-muted break-words">{current.title}</p>
        <div className="progress-track mt-2.5" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${Math.max(progress, 3)}%` }} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-fg-subtle">
          <Clock className="w-3 h-3" />
          {waitingForOwnJob
            ? 'Your job starts automatically the moment this finishes.'
            : 'You can submit now — it will start automatically when this finishes.'}
        </p>
      </div>
    </div>
  );
}
