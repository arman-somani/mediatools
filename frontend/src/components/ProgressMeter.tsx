'use client';

import { useEffect, useRef, useState } from 'react';
import type { JobPhase } from '@/lib/useConversionJob';

/** Ease a number toward its target so the % readout counts up instead of jumping. */
function useTweened(target: number, duration = 550): number {
  const [value, setValue] = useState(target);
  const currentRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = currentRef.current;
    if (Math.abs(target - from) < 0.5) {
      currentRef.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      currentRef.current = v;
      setValue(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

const STAGES = ['SENT', 'QUEUE', 'PROCESS', 'READY'] as const;

function stageIndex(phase: JobPhase): number {
  switch (phase) {
    case 'sending': return 0;
    case 'queued': return 1;
    case 'processing': return 2;
    case 'finalizing': return 3;
    default: return 0;
  }
}

interface ProgressMeterProps {
  phase: JobPhase;
  progress: number;
  queuePosition: number;
  title: string;
  subtitle: string;
}

/**
 * Console-style job readout: a counting % figure over a live level meter,
 * with the pipeline stages laid out underneath. Replaces the old gradient
 * progress ring.
 */
export default function ProgressMeter({ phase, progress, queuePosition, title, subtitle }: ProgressMeterProps) {
  const shown = useTweened(progress);
  const pct = Math.max(0, Math.min(100, shown));
  const stage = stageIndex(phase);
  const bars = 28;

  return (
    <div className="py-6 sm:py-8 anim-fade-in" role="status" aria-live="polite">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="mono-label mb-3">
            <span className="status-dot text-accent inline-block mr-2" />
            {phase === 'queued' ? `QUEUED · POSITION ${queuePosition}` : 'JOB RUNNING'}
          </p>
          <p className="font-mono text-6xl sm:text-7xl font-medium text-fg leading-none tabular-nums">
            {Math.round(pct)}
            <span className="text-2xl sm:text-3xl text-fg-subtle">%</span>
          </p>
        </div>
        <div className="meter flex-1 min-w-[180px] max-w-xs" aria-hidden="true">
          {Array.from({ length: bars }, (_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 7) * 0.09}s`, animationDuration: `${0.8 + (i % 5) * 0.14}s` }} />
          ))}
        </div>
      </div>

      <div className="progress-track mt-6" aria-hidden="true">
        <div className="progress-bar" style={{ width: `${phase === 'queued' ? 4 : pct}%` }} />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg truncate">{title}</h3>
          <p className="text-[13px] text-fg-muted mt-0.5 break-words">{subtitle}</p>
        </div>
      </div>

      <ol className="mt-8 flex items-center gap-2" aria-hidden="true">
        {STAGES.map((s, i) => (
          <li key={s} className="flex items-center gap-2 flex-1 last:flex-none">
            <span className={`mono-label !text-[10px] ${i < stage ? 'text-success' : i === stage ? 'text-accent' : ''}`}>
              {i < stage ? '✓' : ''} {s}
            </span>
            {i < STAGES.length - 1 && (
              <span className={`h-px flex-1 ${i < stage ? 'bg-success/40' : 'bg-line'}`} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
