'use client';

import { useEffect, useRef } from 'react';
import anime from 'animejs';

interface ProgressCircleProps {
  progress: number;
  statusText: string;
  subText?: string;
}

export default function ProgressCircle({ progress, statusText, subText }: ProgressCircleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      anime({
        targets: containerRef.current,
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutSine'
      });
    }
  }, []);

  useEffect(() => {
    if (circleRef.current) {
      const targetDash = Math.max(0, Math.min(progress, 100)) * 2.9;
      anime({
        targets: circleRef.current,
        strokeDasharray: `${targetDash} 300`,
        duration: 500,
        easing: 'easeOutQuart'
      });
    }
  }, [progress]);

  return (
    <div ref={containerRef} className="py-12 flex-1 flex flex-col items-center justify-center text-center opacity-0">
      <div className="relative w-32 h-32 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            ref={circleRef}
            cx="50" cy="50" r="46" fill="none"
            stroke="url(#progressGradient)" strokeWidth="8" strokeLinecap="round"
            style={{ strokeDasharray: '0 300' }}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" /> {/* brand-cyan */}
              <stop offset="100%" stopColor="#a855f7" /> {/* brand-purple */}
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold font-display text-white">{Math.round(progress)}%</span>
        </div>
      </div>
      <h3 className="text-2xl font-display font-bold mb-2 text-white">
        {statusText}
      </h3>
      {subText && (
        <p className="text-white/60 text-sm sm:text-base px-4 max-w-sm w-full leading-relaxed break-words">
          {subText}
        </p>
      )}

      {/* Animated Audio Visualizer Waveform */}
      <div className="flex gap-1.5 justify-center mt-6 h-8 items-end">
        <div className="w-1 bg-brand-cyan rounded-full animate-vis-1" style={{ height: '12px' }} />
        <div className="w-1 bg-brand-purple rounded-full animate-vis-2" style={{ height: '24px' }} />
        <div className="w-1 bg-brand-violet rounded-full animate-vis-3" style={{ height: '32px' }} />
        <div className="w-1 bg-brand-cyan rounded-full animate-vis-4" style={{ height: '20px' }} />
        <div className="w-1 bg-brand-purple rounded-full animate-vis-5" style={{ height: '28px' }} />
        <div className="w-1 bg-brand-violet rounded-full animate-vis-6" style={{ height: '16px' }} />
        <div className="w-1 bg-brand-cyan rounded-full animate-vis-7" style={{ height: '22px' }} />
      </div>
    </div>
  );
}
