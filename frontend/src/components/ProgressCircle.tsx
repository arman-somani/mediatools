'use client';

import { useEffect, useRef } from 'react';
import anime from 'animejs';

interface ProgressCircleProps {
  progress: number;
  statusText: string;
  subText?: string;
}

const R = 52;
const CIRC = 2 * Math.PI * R;

export default function ProgressCircle({ progress, statusText, subText }: ProgressCircleProps) {
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (circleRef.current) {
      const pct = Math.max(0, Math.min(progress, 100)) / 100;
      anime({
        targets: circleRef.current,
        strokeDashoffset: CIRC * (1 - pct),
        duration: 600,
        easing: 'easeOutQuart',
      });
    }
  }, [progress]);

  return (
    <div className="py-10 flex-1 flex flex-col items-center justify-center text-center anim-fade-in" role="status" aria-live="polite">
      <div className="relative w-44 h-44 mb-8">
        {/* Glow + glass disc */}
        <div className="absolute inset-3 rounded-full bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-cyan-400/30 blur-2xl" />
        <div className="absolute inset-5 rounded-full border border-white/15 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-10px_30px_rgba(0,0,0,0.25)]" />
        {/* Rotating sheen */}
        <div className="absolute inset-0 rounded-full anim-spin-slow" style={{ background: 'conic-gradient(from 0deg, transparent 0 75%, rgba(255,255,255,0.12) 90%, transparent 100%)' }} />

        <svg className="relative w-full h-full -rotate-90" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <filter id="progressGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
          <circle
            ref={circleRef}
            cx="60" cy="60" r={R} fill="none"
            stroke="url(#progressGradient)" strokeWidth="7" strokeLinecap="round"
            filter="url(#progressGlow)"
            style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold font-display text-white tabular-nums">{Math.round(progress)}<span className="text-xl text-white/60">%</span></span>
        </div>
      </div>

      <h3 className="text-xl sm:text-2xl font-display font-bold mb-2 text-white">{statusText}</h3>
      {subText && (
        <p className="text-muted text-sm sm:text-base px-4 max-w-sm w-full leading-relaxed break-words">{subText}</p>
      )}

      {/* Audio visualizer */}
      <div className="flex gap-1.5 justify-center mt-7 h-8 items-end" aria-hidden="true">
        {['animate-vis-1', 'animate-vis-2', 'animate-vis-3', 'animate-vis-4', 'animate-vis-5', 'animate-vis-6', 'animate-vis-7'].map((c, i) => (
          <div key={c} className={`w-1.5 rounded-full ${c}`} style={{ height: 12, background: ['#22d3ee', '#a855f7', '#ec4899'][i % 3], boxShadow: `0 0 10px ${['#22d3ee', '#a855f7', '#ec4899'][i % 3]}` }} />
        ))}
      </div>
    </div>
  );
}
