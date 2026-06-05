'use client';
import { motion } from 'framer-motion';

interface ProgressCircleProps {
  progress: number;
  statusText: string;
  subText?: string;
}

export default function ProgressCircle({ progress, statusText, subText }: ProgressCircleProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-12 flex-1 flex flex-col items-center justify-center text-center">
      <div className="relative w-32 h-32 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r="46" fill="none"
            stroke="url(#progressGradient)" strokeWidth="8" strokeLinecap="round"
            initial={{ strokeDasharray: '0 300' }}
            animate={{ strokeDasharray: `${Math.max(0, Math.min(progress, 100)) * 2.9} 300` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
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
        <p className="text-white/60 max-w-sm truncate">
          {subText}
        </p>
      )}
    </motion.div>
  );
}
