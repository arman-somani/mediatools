'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2, Users, AlertCircle, X } from 'lucide-react';

interface QueueModalProps {
  isOpen: boolean;
  queuePosition: number;
  estimatedWaitSeconds: number;
  onCancel?: () => void;
}

export default function QueueModal({
  isOpen,
  queuePosition,
  estimatedWaitSeconds,
  onCancel,
}: QueueModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(estimatedWaitSeconds);

  useEffect(() => {
    setSecondsLeft(estimatedWaitSeconds);
  }, [estimatedWaitSeconds]);

  useEffect(() => {
    if (!isOpen || secondsLeft <= 1) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 1 ? s - 1 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, secondsLeft]);

  if (!isOpen || queuePosition <= 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm anim-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Queue Wait Notice"
    >
      <div className="card-glass relative w-full max-w-md p-6 sm:p-7 border border-accent/30 shadow-2xl rounded-2xl bg-surface/95 text-fg">
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent">
            <Users className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="mono-label !text-[11px] text-accent">HIGH SERVER DEMAND</span>
            <h3 className="text-lg font-bold text-fg">You are in line!</h3>
          </div>
        </div>

        <div className="mt-5 p-4 rounded-xl bg-surface-2/60 border border-line flex items-center justify-between">
          <div>
            <p className="text-xs text-fg-muted font-medium">YOUR QUEUE POSITION</p>
            <p className="font-mono text-3xl font-extrabold text-accent mt-0.5">
              #{queuePosition}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-fg-muted font-medium">ESTIMATED WAIT</p>
            <p className="font-mono text-2xl font-semibold text-fg mt-0.5 flex items-center justify-end gap-1.5">
              <Clock className="w-4 h-4 text-accent" />
              ~{secondsLeft}s
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              Processing preceding job...
            </span>
            <span className="font-mono">Queue active</span>
          </div>
          <div className="progress-track h-2">
            <div className="progress-bar animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-surface-3/50 border border-line-subtle text-xs text-fg-muted flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            To prevent server crashes, tasks run one-by-one with dedicated resources. 
            Your task will begin automatically as soon as the previous task finishes.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-[12px] text-fg-subtle">Please do not close this tab</span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-danger hover:underline font-medium"
            >
              Cancel task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

